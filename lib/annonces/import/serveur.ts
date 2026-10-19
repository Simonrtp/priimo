/**
 * Une URL collée dans le panneau Annonces : la retrouver, la localiser, la
 * garder en attente d'ajout. Serveur uniquement (service role pour l'écriture).
 *
 * Ordre : nos données d'abord (instantané), puis Bien'ici en direct, puis la
 * file du PC de la veille (PAP, SeLoger), sinon le texte collé.
 *
 * Sans la migration 20261019_annonces_import_url, la recherche et la
 * localisation marchent ; l'ajout, le suivi et la file du PC attendent les
 * tables (`disponible: false`).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { lireAnnonceParPortail } from '@/lib/annonces/lire';
import { libellePortail } from '@/lib/annonces/presenter';
import type { Annonce } from '@/lib/annonces/types';
import { lireBienici } from './bienici';
import { carteDepuisAnnonce, carteDepuisFiche, colonnesAnnonce, type CarteImport } from './carte';
import { localiserFiche } from './localiser';
import { ficheDepuisTexte } from './texte';
import type { FicheAnnonce, LocalisationImport } from './types';
import { cleImport, lisiblePc, type UrlAnnonce } from './url';

/** Les tables des annonces vivent hors des types générés (écrites par le pipeline). */
type Db = SupabaseClient;
type DbType = SupabaseClient<Database>;
const type = (db: Db) => db as unknown as DbType;

export type Qui = { agencyId: string; profileId: string; codesPostaux: readonly string[] };

export type ReponseImport =
  | { etat: 'trouvee'; carte: CarteImport; disponible: boolean }
  | { etat: 'en_lecture'; importId: string; lent: boolean }
  | { etat: 'texte'; raison: 'illisible' | 'pc' | 'echec' }
  | { etat: 'erreur'; message: string };

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

/** Une fiche lue (Bien'ici ou texte) : localisée, gardée en attente d'ajout. */
async function resultatFiche(admin: Db, qui: Qui, u: UrlAnnonce, fiche: FicheAnnonce): Promise<ReponseImport> {
  const loc: LocalisationImport = await localiserFiche(fiche);
  const colonnes = colonnesAnnonce(fiche, loc);
  const { id, disponible } = await enregistrer(admin, qui, u, { statut: 'lue', resultat: colonnes });
  return { etat: 'trouvee', carte: carteDepuisFiche(fiche, loc, { importId: id, annonceId: null, suivie: false }), disponible };
}

export async function importerUrl(admin: Db, db: Db, qui: Qui, u: UrlAnnonce): Promise<ReponseImport> {
  // 1. Déjà vue par la veille ou ajoutée par une agence.
  const connue = await lireAnnonceParPortail(type(admin), u.portail, cleImport(u));
  if (connue) {
    if (await visiblePourAgence(admin, connue, qui)) {
      const { suivie, disponible } = await etatSuivi(db, connue.id, qui.profileId);
      return { etat: 'trouvee', carte: carteDepuisAnnonce(connue, { annonceId: connue.id, suivie }), disponible };
    }
    // Connue ailleurs (autre territoire) : rien à relire, l'ajout la rattachera.
    const { id, disponible } = await enregistrer(admin, qui, u, { statut: 'lue', resultat: { annonce_existante: connue.id } });
    return { etat: 'trouvee', carte: carteDepuisAnnonce(connue, { annonceId: null, suivie: false }), disponible: disponible && id != null };
  }

  // 2. Bien'ici se lit en direct.
  if (u.portail === 'bienici' && u.idPortail) {
    const fiche = await lireBienici(u.idPortail, u.url);
    if (!fiche) return { etat: 'erreur', message: 'Annonce introuvable sur Bien’ici' };
    return resultatFiche(admin, qui, u, fiche);
  }

  // 3. PAP et SeLoger : le PC de la veille les lit.
  if (lisiblePc(u.portail) && u.idPortail) {
    const { id } = await enregistrer(admin, qui, u, { statut: 'en_attente' });
    if (id) return { etat: 'en_lecture', importId: id, lent: false };
    return { etat: 'texte', raison: 'pc' };
  }

  // 4. Leboncoin, Logic-Immo, Le Figaro, site d'agence : le texte collé.
  return { etat: 'texte', raison: 'illisible' };
}

export async function importerTexte(admin: Db, qui: Qui, u: UrlAnnonce, texte: string): Promise<ReponseImport> {
  const fiche = await ficheDepuisTexte(u, texte);
  if (!fiche) return { etat: 'erreur', message: 'Texte illisible : collez toute la page de l’annonce' };
  return resultatFiche(admin, qui, u, fiche);
}

/** Délai au-delà duquel le panneau propose le texte collé (le PC est sans doute éteint). */
const LECTURE_LENTE_MS = 45_000;

type LigneImport = {
  id: string;
  statut: string;
  resultat: Record<string, unknown> | null;
  erreur: string | null;
  annonce_id: string | null;
  cree_le: string;
  url: string;
  portail: string;
};

/** Où en est la lecture d'une URL par le PC. */
export async function etatImport(admin: Db, qui: Qui, importId: string): Promise<ReponseImport> {
  const { data, error } = await admin
    .from('annonces_imports')
    .select('id, statut, resultat, erreur, annonce_id, cree_le, url, portail')
    .eq('id', importId)
    .eq('profile_id', qui.profileId)
    .maybeSingle();
  if (error || !data) return { etat: 'erreur', message: 'Recherche introuvable' };
  const ligne = data as LigneImport;
  if (ligne.statut === 'echec') return { etat: 'texte', raison: 'echec' };
  if (ligne.statut !== 'lue' || !ligne.resultat) {
    return { etat: 'en_lecture', importId, lent: Date.now() - Date.parse(ligne.cree_le) > LECTURE_LENTE_MS };
  }
  return { etat: 'trouvee', carte: carteDepuisResultat(ligne), disponible: true };
}

function carteDepuisResultat(ligne: LigneImport): CarteImport {
  const r = ligne.resultat ?? {};
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const t = (v: unknown) => (typeof v === 'string' && v.trim() ? v : null);
  const confiance = (t(r.confiance) ?? 'incertaine') as CarteImport['confiance'];
  const photos = Array.isArray(r.photos) ? (r.photos as unknown[]).filter((p): p is string => typeof p === 'string') : [];
  return {
    importId: ligne.id,
    annonceId: ligne.annonce_id,
    suivie: false,
    portail: libellePortail(t(r.portail) ?? ligne.portail),
    url: t(r.url) ?? ligne.url,
    particulier: r.type_vendeur !== 'professionnel',
    agence: t(r.agence_nom),
    prix: n(r.prix),
    surface: n(r.surface),
    pieces: n(r.pieces),
    etage: r.etage == null ? null : String(r.etage),
    dpe: t(r.dpe),
    confiance,
    adresse: confiance === 'incertaine' ? null : t(r.adresse),
    latitude: n(r.latitude),
    longitude: n(r.longitude),
    approximative: confiance === 'incertaine',
    parcelleId: Array.isArray(r.parcelle_ids) ? (t(r.parcelle_ids[0]) ?? null) : null,
    photo: photos[0] ?? null,
  };
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
