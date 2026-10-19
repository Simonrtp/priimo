/**
 * Une URL collée dans le panneau Annonces : la retrouver, la localiser, la
 * garder en attente d'ajout. Serveur uniquement (service role pour l'écriture).
 *
 * Ordre : nos données d'abord (instantané, gratuit : chaque URL n'est lue
 * qu'une fois pour tout Priimo), Bien'ici par son API, puis n'importe quel
 * site téléchargé par Bright Data et lu (données de la page + Mon assistant).
 * Si la page ne se lit pas, l'agent colle le texte.
 *
 * Chaque étape est annoncée (`onEtape`) : le panneau l'affiche en direct.
 * Sans la migration 20261019_annonces_import_url, l'ajout attend les tables
 * (`disponible: false`) ; la recherche et la carte marchent.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { lireAnnonceParPortail } from '@/lib/annonces/lire';
import { libellePortail } from '@/lib/annonces/presenter';
import type { Annonce } from '@/lib/annonces/types';
import { lireBienici } from './bienici';
import { carteDepuisAnnonce, carteDepuisFiche, colonnesAnnonce, type CarteImport } from './carte';
import { ficheDepuisPage } from './fiche';
import { localiserFiche } from './localiser';
import { telechargerPage } from './telecharger';
import { ficheDepuisTexte } from './texte';
import type { FicheAnnonce, LocalisationImport } from './types';
import { cleImport, type UrlAnnonce } from './url';

/** Les tables des annonces vivent hors des types générés (écrites par le pipeline). */
type Db = SupabaseClient;
type DbType = SupabaseClient<Database>;
const type = (db: Db) => db as unknown as DbType;

export type Qui = { agencyId: string; profileId: string; codesPostaux: readonly string[] };

export type ReponseImport =
  | { etat: 'trouvee'; carte: CarteImport; disponible: boolean }
  | { etat: 'texte'; raison: 'illisible' | 'bloquee' }
  | { etat: 'erreur'; message: string };

/** Les étapes que le panneau montre en bulles pendant la recherche. */
export type EtapeImport = {
  cle: 'lecture' | 'donnees' | 'adresse';
  etat: 'en_cours' | 'fait' | 'rate';
  detail?: string;
};
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
  if (!c.approximative && c.adresse) return c.adresse.replace(/\s\d{5}\s.*$/, '');
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

async function visiblePourAgence(admin: Db, a: Annonce, qui: Qui): Promise<boolean> {
  if (a.codePostal && qui.codesPostaux.includes(a.codePostal)) return true;
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
  champs: { statut: 'en_attente' | 'lue'; resultat?: Record<string, unknown> | null },
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
      lue_le: champs.statut === 'lue' ? new Date().toISOString() : null,
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

/** Une fiche lue : localisée, gardée en attente d'ajout. */
async function resultatFiche(admin: Db, qui: Qui, u: UrlAnnonce, fiche: FicheAnnonce, onEtape: SurEtape): Promise<ReponseImport> {
  onEtape({ cle: 'donnees', etat: 'fait', detail: resumeDonnees(fiche) });
  onEtape({ cle: 'adresse', etat: 'en_cours' });
  const loc: LocalisationImport = await localiserFiche(fiche);
  const colonnes = colonnesAnnonce(fiche, loc);
  const { id, disponible } = await enregistrer(admin, qui, u, { statut: 'lue', resultat: colonnes });
  const carte = carteDepuisFiche(fiche, loc, { importId: id, annonceId: null, suivie: false });
  onEtape({ cle: 'adresse', etat: carte.approximative ? 'rate' : 'fait', detail: resumeAdresse(carte) });
  return { etat: 'trouvee', carte, disponible };
}

export async function importerUrl(admin: Db, db: Db, qui: Qui, u: UrlAnnonce, onEtape: SurEtape = rien): Promise<ReponseImport> {
  onEtape({ cle: 'lecture', etat: 'en_cours' });
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
    return { etat: 'trouvee', carte, disponible: visible ? (etat?.disponible ?? true) : Boolean(enregistre?.disponible && enregistre.id) };
  }

  // 2. Bien'ici : son API, gratuite.
  let fiche: FicheAnnonce | null = null;
  if (u.portail === 'bienici' && u.idPortail) {
    fiche = await lireBienici(u.idPortail, u.url);
  }

  // 3. Tout autre site : la page téléchargée, puis lue.
  if (!fiche) {
    const page = await telechargerPage(u.url);
    if (!page.ok) {
      onEtape({ cle: 'lecture', etat: 'rate' });
      if (page.raison === 'disparue') return { etat: 'erreur', message: 'Cette annonce n’est plus en ligne' };
      return { etat: 'texte', raison: page.raison === 'sans_cle' ? 'illisible' : 'bloquee' };
    }
    onEtape({ cle: 'lecture', etat: 'fait', detail: portail });
    onEtape({ cle: 'donnees', etat: 'en_cours' });
    fiche = await ficheDepuisPage(u, page.html);
    if (!fiche) {
      onEtape({ cle: 'donnees', etat: 'rate' });
      return { etat: 'texte', raison: 'bloquee' };
    }
  } else {
    onEtape({ cle: 'lecture', etat: 'fait', detail: portail });
  }
  return resultatFiche(admin, qui, u, fiche, onEtape);
}

export async function importerTexte(admin: Db, qui: Qui, u: UrlAnnonce, texte: string, onEtape: SurEtape = rien): Promise<ReponseImport> {
  onEtape({ cle: 'donnees', etat: 'en_cours' });
  const fiche = await ficheDepuisTexte(u, texte);
  if (!fiche) {
    onEtape({ cle: 'donnees', etat: 'rate' });
    return { etat: 'erreur', message: 'Texte illisible : collez toute la page de l’annonce' };
  }
  return resultatFiche(admin, qui, u, fiche, onEtape);
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
    delete colonnes.photos;
    if (!colonnes.code_postal) return { erreur: 'Code postal inconnu : impossible d’ajouter' };
    const { data: inseree, error: errInsert } = await admin
      .from('annonces')
      .upsert(colonnes, { onConflict: 'portail,id_portail', ignoreDuplicates: true })
      .select('id')
      .maybeSingle();
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
