/**
 * Une URL collée dans le panneau Annonces : la retrouver, la localiser, la
 * garder en attente d'ajout. Serveur uniquement (service role pour l'écriture).
 *
 * Ordre : nos données d'abord (instantané, gratuit : chaque URL n'est lue
 * qu'une fois pour tout Priimo), Bien'ici par son API, puis n'importe quel
 * site téléchargé par Bright Data et lu (données de la page + Mon assistant).
 * Tout est automatique : l'agent colle l'URL, rien d'autre. Une page qui
 * n'arrive pas est redemandée une fois ; Mon assistant est relu une fois.
 *
 * Garde-fous de facture (Bright Data est payé à la page) :
 *   - une URL déjà lue (7 jours) est reprise en base, sans nouvel appel ;
 *   - une page qui vient d'échouer n'est pas relancée avant un quart d'heure ;
 *   - plafonds du jour par agent, agence et pour tout Priimo, sur un compteur
 *     commun à tous les serveurs ; sans compteur, rien ne part ;
 *   - une seule lecture à la fois par agent ; la croix l'arrête ;
 *   - aucune pour une agence en attente.
 *
 * Chaque étape est annoncée (`onEtape`) : le panneau l'affiche en direct.
 * Sans la migration 20261019_annonces_import_url, l'ajout attend les tables
 * (`disponible: false`) ; la recherche et la carte marchent.
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { lireAnnonceParPortail } from '@/lib/annonces/lire';
import { libellePortail } from '@/lib/annonces/presenter';
import type { AdressePossible, Annonce, PrecisionLocalisation } from '@/lib/annonces/types';
import { PLAFONDS_LECTURE_ANNONCE, plafondsLecturePage } from '@/lib/quota/regles';
import { reserverQuota } from '@/lib/quota/reserver';
import { lireBienici } from './bienici';
import { carteDepuisAnnonce, carteDepuisFiche, colonnesAnnonce, rayonDuRepere, type CarteImport } from './carte';
import { ficheDepuisPage } from './fiche';
import { localiserFiche, MOTEUR_LOCALISATION_DEPUIS } from './localiser';
import { telechargerPage } from './telecharger';
import { extraireAvecAssistant } from './texte';
import type { FicheAnnonce, LocalisationImport } from './types';
import { MESSAGE_RECHERCHE_ARRETEE, MESSAGE_RECHERCHE_EN_COURS } from './messages';
import { cleImport, type UrlAnnonce } from './url';

/** Les tables des annonces vivent hors des types générés (écrites par le pipeline). */
type Db = SupabaseClient;
type DbType = SupabaseClient<Database>;
const type = (db: Db) => db as unknown as DbType;

export type Qui = {
  agencyId: string;
  profileId: string;
  codesPostaux: readonly string[];
  /** Faux pour une agence en attente de validation : pas de page téléchargée. */
  pagesAutorisees: boolean;
};

export type ReponseImport =
  | { etat: 'trouvee'; carte: CarteImport; disponible: boolean }
  | { etat: 'erreur'; message: string };

/** Les étapes que le panneau montre en bulles pendant la recherche. */
export type EtapeImport = {
  cle: 'lecture' | 'donnees' | 'adresse';
  etat: 'en_cours' | 'fait' | 'rate';
  detail?: string;
  /** Mon assistant lit la page : la bulle passe au bleu IA. */
  ia?: boolean;
};

/** Ce que l'agent lit quand la recherche s'arrête : une phrase, jamais un formulaire. */
const MESSAGES = {
  disparue: 'Cette annonce n’est plus en ligne',
  injoignable: 'Le site ne répond pas : réessayez dans quelques minutes',
  illisible: 'Aucune annonce lisible sur cette page',
  plafond: 'Limite de lectures du jour atteinte : elle se rouvre demain',
  attente: 'Lecture des annonces ouverte une fois l’agence validée',
  indisponible: 'Lecture des annonces indisponible pour le moment',
} as const;
type SurEtape = (e: EtapeImport) => void;
const rien: SurEtape = () => {};

function euros(n: number): string {
  return `${new Intl.NumberFormat('fr-FR').format(Math.round(n))} €`;
}

/** « 472 500 € · 45 m² · DPE D » */
function resumeDonnees(f: Pick<FicheAnnonce, 'prix' | 'surface' | 'dpe'>): string {
  return [f.prix != null ? euros(f.prix) : null, f.surface != null ? `${new Intl.NumberFormat('fr-FR').format(f.surface)} m²` : null, f.dpe ? `DPE ${f.dpe}` : null]
    .filter(Boolean)
    .join(' · ');
}

function resumeAdresse(c: Pick<CarteImport, 'adresse' | 'approximative' | 'latitude'>): string {
  if (c.adresse) return c.adresse.replace(/\s\d{5}\s.*$/, '');
  return c.latitude != null ? 'Secteur approximatif' : 'Adresse introuvable';
}

/** La table manque (migration non appliquée) : PostgREST 42P01 / PGRST205. */
export function tableAbsente(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === '42P01' || error.code === 'PGRST205' || /does not exist|could not find the table/i.test(error.message ?? '');
}

/** Suivie par l'agent ? `disponible` : faux tant que la table n'existe pas (cloche cachée). */
async function etatSuivi(db: Db, annonceId: string, profileId: string): Promise<{ suivie: boolean; disponible: boolean }> {
  const { data, error } = await db
    .from('annonces_suivies')
    .select('id')
    .eq('annonce_id', annonceId)
    .eq('profile_id', profileId)
    .maybeSingle();
  return { suivie: !error && Boolean(data), disponible: !tableAbsente(error) };
}

/** Déjà dans les annonces de l'agence : le lien `annonces_agences`, rien d'autre (plus de veille par code postal). */
async function visiblePourAgence(admin: Db, a: Annonce, qui: Qui): Promise<boolean> {
  const { data, error } = await admin
    .from('annonces_agences')
    .select('annonce_id')
    .eq('annonce_id', a.id)
    .eq('agency_id', qui.agencyId)
    .maybeSingle();
  return !error && Boolean(data);
}

async function enregistrer(
  admin: Db,
  qui: Qui,
  u: UrlAnnonce,
  champs: { statut: 'lue' | 'echec'; resultat?: Record<string, unknown> | null; erreur?: string },
): Promise<{ id: string | null; disponible: boolean }> {
  const { data, error } = await admin
    .from('annonces_imports')
    .insert({
      agency_id: qui.agencyId,
      profile_id: qui.profileId,
      url: u.url,
      portail: u.portail,
      id_portail: cleImport(u),
      statut: champs.statut,
      resultat: champs.resultat ?? null,
      erreur: champs.erreur ?? null,
      lue_le: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (tableAbsente(error)) return { id: null, disponible: false };
  if (error) {
    console.error('[import] enregistrement', error.message);
    return { id: null, disponible: false };
  }
  return { id: String((data as { id: string }).id), disponible: true };
}

const SEMAINE_MS = 7 * 86_400_000;
const ECHEC_MS = 15 * 60_000;

/** La dernière lecture de cette URL, par n'importe quelle agence (cache partagé). */
async function derniereLecture(
  admin: Db,
  u: UrlAnnonce,
): Promise<{ statut: string; resultat: Record<string, unknown> | null; erreur: string | null; lueLe: number } | null> {
  const { data, error } = await admin
    .from('annonces_imports')
    .select('statut, resultat, erreur, lue_le')
    .eq('portail', u.portail)
    .eq('id_portail', cleImport(u))
    .in('statut', ['lue', 'echec'])
    // Une semaine au plus, et jamais d'une version antérieure du moteur de localisation.
    .gte('lue_le', new Date(Math.max(Date.now() - SEMAINE_MS, Date.parse(MOTEUR_LOCALISATION_DEPUIS))).toISOString())
    .order('lue_le', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as { statut: string; resultat: Record<string, unknown> | null; erreur: string | null; lue_le: string };
  return { statut: row.statut, resultat: row.resultat, erreur: row.erreur, lueLe: Date.parse(row.lue_le) };
}

/** Colonnes `annonces` gardées en base → carte du panneau. */
export function carteDepuisColonnes(r: Record<string, unknown>, importId: string | null): CarteImport {
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const t = (v: unknown) => (typeof v === 'string' && v.trim() ? v : null);
  const confiance = (t(r.confiance) ?? 'incertaine') as CarteImport['confiance'];
  const photos = Array.isArray(r.photos) ? (r.photos as unknown[]).filter((p): p is string => typeof p === 'string') : [];
  return {
    importId,
    annonceId: null,
    suivie: false,
    portail: libellePortail(t(r.portail) ?? 'autre'),
    portailCle: t(r.portail) ?? 'autre',
    url: t(r.url) ?? '',
    particulier: r.type_vendeur !== 'professionnel',
    agence: t(r.agence_nom),
    prix: n(r.prix),
    surface: n(r.surface),
    pieces: n(r.pieces),
    etage: r.etage == null ? null : String(r.etage),
    dpe: t(r.dpe),
    confiance,
    adresse: t(r.adresse),
    latitude: n(r.latitude),
    longitude: n(r.longitude),
    approximative: confiance === 'incertaine',
    rayonM: rayonDuRepere(
      confiance,
      t(r.localisation_precision) as PrecisionLocalisation | null,
      n(r.rayon_m),
    ),
    adressesPossibles: confiance === 'incertaine' ? adressesPossiblesDe(r.adresses_possibles) : [],
    parcelleId: Array.isArray(r.parcelle_ids) ? (t(r.parcelle_ids[0]) ?? null) : null,
    photo: photos[0] ?? null,
  };
}

/** Les adresses possibles gardées en base (jsonb) ; une valeur mal formée est ignorée. */
export function adressesPossiblesDe(v: unknown): AdressePossible[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((x) => {
    const o = x && typeof x === 'object' ? (x as Record<string, unknown>) : null;
    if (!o || typeof o.adresse !== 'string' || typeof o.latitude !== 'number' || typeof o.longitude !== 'number') return [];
    return [{ adresse: o.adresse, latitude: o.latitude, longitude: o.longitude }];
  });
}

/** Colonne `adresses_possibles` pas encore créée (migration 20261021) : PostgREST la dit introuvable. */
function colonnePossiblesAbsente(message: string | undefined): boolean {
  return /adresses_possibles/.test(message ?? '');
}

/**
 * Une lecture à la fois par agent, sur cette instance. La croix annule le
 * contrôleur : le téléchargement s'arrête. Une deuxième demande pour la même
 * annonce attend le même résultat, au lieu d'un message opaque.
 */
type TacheLecture = {
  cle: string;
  controleur: AbortController;
  promesse: Promise<ReponseImport>;
};
const taches = new Map<string, TacheLecture>();

export function annulerLecture(profileId: string): void {
  const tache = taches.get(profileId);
  if (!tache) return;
  taches.delete(profileId);
  tache.controleur.abort();
}

function arretSiBesoin(signal: AbortSignal, resultat: ReponseImport): ReponseImport {
  if (signal.aborted) return { etat: 'erreur', message: MESSAGE_RECHERCHE_ARRETEE };
  return resultat;
}

/** Mon assistant n'est appelé que dans la limite de son plafond ; sa bulle passe au bleu IA. */
function assistantPlafonne(qui: Qui, onEtape: SurEtape, signal: AbortSignal) {
  return async (texte: string) => {
    if (signal.aborted) return null;
    const r = await reserverQuota('lecture_annonce', PLAFONDS_LECTURE_ANNONCE, qui);
    if (r === 'plafond' || signal.aborted) return null;
    onEtape({ cle: 'donnees', etat: 'en_cours', ia: true });
    return extraireAvecAssistant(texte, signal);
  };
}

/** Une fiche lue : localisée, gardée en attente d'ajout. */
async function resultatFiche(
  admin: Db,
  qui: Qui,
  u: UrlAnnonce,
  fiche: FicheAnnonce,
  onEtape: SurEtape,
  signal: AbortSignal,
): Promise<ReponseImport> {
  if (signal.aborted) return { etat: 'erreur', message: MESSAGE_RECHERCHE_ARRETEE };
  onEtape({ cle: 'donnees', etat: 'fait', detail: resumeDonnees(fiche) });
  onEtape({ cle: 'adresse', etat: 'en_cours' });
  const loc: LocalisationImport = await localiserFiche(fiche);
  if (signal.aborted) return { etat: 'erreur', message: MESSAGE_RECHERCHE_ARRETEE };
  const colonnes = colonnesAnnonce(fiche, loc);
  const { id, disponible } = await enregistrer(admin, qui, u, { statut: 'lue', resultat: colonnes });
  const carte = carteDepuisFiche(fiche, loc, { importId: id, annonceId: null, suivie: false });
  onEtape({ cle: 'adresse', etat: carte.approximative ? 'rate' : 'fait', detail: resumeAdresse(carte) });
  return arretSiBesoin(signal, { etat: 'trouvee', carte, disponible });
}

async function lireUrl(
  admin: Db,
  db: Db,
  qui: Qui,
  u: UrlAnnonce,
  onEtape: SurEtape,
  signal: AbortSignal,
): Promise<ReponseImport> {
  onEtape({ cle: 'lecture', etat: 'en_cours' });
  await new Promise<void>((ok) => setImmediate(ok));
  const portail = libellePortail(u.portail);

  // 1. Déjà connue : lue par la veille ou collée par une agence (une seule lecture pour tout Priimo).
  const connue = await lireAnnonceParPortail(type(admin), u.portail, cleImport(u));
  if (connue) {
    onEtape({ cle: 'lecture', etat: 'fait', detail: portail });
    onEtape({ cle: 'donnees', etat: 'fait', detail: resumeDonnees(connue) });
    const visible = await visiblePourAgence(admin, connue, qui);
    const etat = visible ? await etatSuivi(db, connue.id, qui.profileId) : null;
    const enregistre = visible ? null : await enregistrer(admin, qui, u, { statut: 'lue', resultat: { annonce_existante: connue.id } });
    const carte = carteDepuisAnnonce(connue, { annonceId: visible ? connue.id : null, suivie: etat?.suivie ?? false });
    if (enregistre) carte.importId = enregistre.id;
    onEtape({ cle: 'adresse', etat: carte.approximative ? 'rate' : 'fait', detail: resumeAdresse(carte) });
    return arretSiBesoin(signal, {
      etat: 'trouvee',
      carte,
      disponible: visible ? (etat?.disponible ?? true) : Boolean(enregistre?.disponible && enregistre.id),
    });
  }

  // 2. Bien'ici : son API, gratuite.
  let fiche: FicheAnnonce | null = null;
  if (u.portail === 'bienici' && u.idPortail) {
    fiche = await lireBienici(u.idPortail, u.url);
  }

  // 3. Tout autre site : la page téléchargée (payante), puis lue.
  if (!fiche) {
    const derniere = await derniereLecture(admin, u);
    // Déjà lue par une agence : reprise telle quelle, sans nouvel appel.
    if (derniere?.statut === 'lue' && derniere.resultat && !derniere.resultat.annonce_existante) {
      const carteCache = carteDepuisColonnes(derniere.resultat, null);
      // Sans adresse sûre (secteur, rue seule) : relire. Le moteur progresse et la base DPE
      // arrive par lots — la même URL peut donner une adresse le lendemain.
      if (!carteCache.approximative) {
        const { id, disponible } = await enregistrer(admin, qui, u, { statut: 'lue', resultat: derniere.resultat });
        const carte = carteDepuisColonnes(derniere.resultat, id);
        onEtape({ cle: 'lecture', etat: 'fait', detail: portail });
        onEtape({ cle: 'donnees', etat: 'fait', detail: resumeDonnees(carte) });
        onEtape({ cle: 'adresse', etat: carte.approximative ? 'rate' : 'fait', detail: resumeAdresse(carte) });
        return { etat: 'trouvee', carte, disponible };
      }
    }
    if (derniere?.statut === 'echec' && Date.now() - derniere.lueLe < ECHEC_MS) {
      onEtape({ cle: 'lecture', etat: 'rate' });
      const message = derniere.erreur === 'disparue' ? MESSAGES.disparue : derniere.erreur === 'illisible' ? MESSAGES.illisible : MESSAGES.injoignable;
      return { etat: 'erreur', message };
    }
    if (!qui.pagesAutorisees) {
      onEtape({ cle: 'lecture', etat: 'rate' });
      return { etat: 'erreur', message: MESSAGES.attente };
    }
    if (signal.aborted) return { etat: 'erreur', message: MESSAGE_RECHERCHE_ARRETEE };
    const reservation = await reserverQuota('lecture_page', plafondsLecturePage(), qui);
    if (signal.aborted) return { etat: 'erreur', message: MESSAGE_RECHERCHE_ARRETEE };
    if (reservation !== 'ok') {
      onEtape({ cle: 'lecture', etat: 'rate' });
      return { etat: 'erreur', message: reservation === 'plafond' ? MESSAGES.plafond : MESSAGES.indisponible };
    }
    const page = await telechargerPage(u.url, signal);
    if (!page.ok) {
      if (page.raison === 'abandon' || signal.aborted) return { etat: 'erreur', message: MESSAGE_RECHERCHE_ARRETEE };
      onEtape({ cle: 'lecture', etat: 'rate' });
      if (page.raison === 'sans_cle') {
        console.error('[import] BRIGHTDATA_API_TOKEN ou BRIGHTDATA_ZONE manquant');
        return { etat: 'erreur', message: MESSAGES.indisponible };
      }
      await enregistrer(admin, qui, u, { statut: 'echec', erreur: page.raison });
      return { etat: 'erreur', message: page.raison === 'disparue' ? MESSAGES.disparue : MESSAGES.injoignable };
    }
    onEtape({ cle: 'lecture', etat: 'fait', detail: portail });
    onEtape({ cle: 'donnees', etat: 'en_cours' });
    fiche = await ficheDepuisPage(u, page.html, assistantPlafonne(qui, onEtape, signal));
    if (signal.aborted) return { etat: 'erreur', message: MESSAGE_RECHERCHE_ARRETEE };
    if (!fiche) {
      onEtape({ cle: 'donnees', etat: 'rate' });
      // Page payée mais sans annonce : pas de nouvel achat avant un quart d'heure.
      await enregistrer(admin, qui, u, { statut: 'echec', erreur: 'illisible' });
      return { etat: 'erreur', message: MESSAGES.illisible };
    }
  } else {
    onEtape({ cle: 'lecture', etat: 'fait', detail: portail });
  }
  return resultatFiche(admin, qui, u, fiche, onEtape, signal);
}

export async function importerUrl(admin: Db, db: Db, qui: Qui, u: UrlAnnonce, onEtape: SurEtape = rien): Promise<ReponseImport> {
  const cle = cleImport(u);
  const enCours = taches.get(qui.profileId);
  if (enCours) {
    if (enCours.cle === cle) return enCours.promesse;
    return { etat: 'erreur', message: MESSAGE_RECHERCHE_EN_COURS };
  }

  const controleur = new AbortController();
  let finir!: (r: ReponseImport) => void;
  const promesse = new Promise<ReponseImport>((ok) => {
    finir = ok;
  });
  const tache: TacheLecture = { cle, controleur, promesse };
  taches.set(qui.profileId, tache);
  void lireUrl(admin, db, qui, u, onEtape, controleur.signal)
    .then(finir)
    .catch((err) => {
      console.error('[import]', err instanceof Error ? err.message : err);
      finir({ etat: 'erreur', message: 'Recherche impossible' });
    })
    .finally(() => {
      if (taches.get(qui.profileId) === tache) taches.delete(qui.profileId);
    });
  return promesse;
}

/**
 * « Ajouter » : l'annonce entre dans les annonces de l'agence. Une annonce
 * déjà connue (même portail, même identifiant) n'est pas dupliquée : seul le
 * lien avec l'agence est posé.
 */
export async function ajouterImport(admin: Db, qui: Qui, importId: string): Promise<{ annonceId: string } | { erreur: string }> {
  const { data, error } = await admin
    .from('annonces_imports')
    .select('id, statut, resultat, annonce_id, portail, id_portail')
    .eq('id', importId)
    .eq('profile_id', qui.profileId)
    .maybeSingle();
  if (tableAbsente(error)) return { erreur: 'Ajout indisponible pour le moment' };
  if (error || !data) return { erreur: 'Recherche introuvable' };
  const ligne = data as { statut: string; resultat: Record<string, unknown> | null; annonce_id: string | null; portail: string; id_portail: string | null };
  if (ligne.statut !== 'lue' || !ligne.resultat) return { erreur: 'Annonce pas encore lue' };

  let annonceId = ligne.annonce_id ?? (typeof ligne.resultat.annonce_existante === 'string' ? ligne.resultat.annonce_existante : null);
  if (!annonceId) {
    const colonnes = { ...ligne.resultat };
    if (!colonnes.code_postal) return { erreur: 'Code postal inconnu : impossible d’ajouter' };
    const inserer = (valeurs: Record<string, unknown>) =>
      admin.from('annonces').upsert(valeurs, { onConflict: 'portail,id_portail', ignoreDuplicates: true }).select('id').maybeSingle();
    let { data: inseree, error: errInsert } = await inserer(colonnes);
    // Avant la migration des adresses possibles : l'annonce s'ajoute quand même, sans elles.
    if (errInsert && colonnePossiblesAbsente(errInsert.message)) {
      delete colonnes.adresses_possibles;
      ({ data: inseree, error: errInsert } = await inserer(colonnes));
    }
    if (errInsert) {
      console.error('[import] ajout', errInsert.message);
      return { erreur: 'Ajout impossible' };
    }
    annonceId = (inseree as { id: string } | null)?.id ?? null;
    if (!annonceId) {
      const existante = await lireAnnonceParPortail(type(admin), String(colonnes.portail), String(colonnes.id_portail));
      annonceId = existante?.id ?? null;
    }
  }
  if (!annonceId) return { erreur: 'Ajout impossible' };

  const { error: errLien } = await admin
    .from('annonces_agences')
    .upsert({ annonce_id: annonceId, agency_id: qui.agencyId, ajoutee_par: qui.profileId }, { onConflict: 'annonce_id,agency_id', ignoreDuplicates: true });
  if (errLien) {
    console.error('[import] lien agence', errLien.message);
    return { erreur: tableAbsente(errLien) ? 'Ajout indisponible pour le moment' : 'Ajout impossible' };
  }
  await admin.from('annonces_imports').update({ annonce_id: annonceId }).eq('id', importId);
  return { annonceId };
}

/** « Retirer de la carte » : le lien de l'agence saute. L'annonce publique reste. */
export async function retirerAnnonceAgence(
  admin: Db,
  qui: Qui,
  annonceId: string,
): Promise<{ ok: true } | { erreur: string }> {
  const { error } = await admin
    .from('annonces_agences')
    .delete()
    .eq('annonce_id', annonceId)
    .eq('agency_id', qui.agencyId);
  if (error) {
    console.error('[import] retrait', error.message);
    return { erreur: tableAbsente(error) ? 'Retrait indisponible pour le moment' : 'Retrait impossible' };
  }
  return { ok: true };
}

/** La cloche : l'agent suit (ou ne suit plus) l'annonce. RLS : ses propres suivis. */
export async function suivreAnnonce(db: Db, qui: Qui, annonceId: string, actif: boolean): Promise<{ ok: boolean; disponible: boolean }> {
  if (actif) {
    const { error } = await db
      .from('annonces_suivies')
      .upsert({ annonce_id: annonceId, agency_id: qui.agencyId, profile_id: qui.profileId }, { onConflict: 'annonce_id,profile_id', ignoreDuplicates: true });
    if (tableAbsente(error)) return { ok: false, disponible: false };
    return { ok: !error, disponible: true };
  }
  const { error } = await db.from('annonces_suivies').delete().eq('annonce_id', annonceId).eq('profile_id', qui.profileId);
  if (tableAbsente(error)) return { ok: false, disponible: false };
  return { ok: !error, disponible: true };
}
