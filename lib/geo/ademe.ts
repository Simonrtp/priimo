/**
 * Client de la base DPE publique (ADEME / data-fair).
 *
 * Seul point réseau de la veille : tout le reste du moteur est pur. La donnée
 * est ouverte et gratuite, il n'y a ni clé ni quota contractuel — on reste
 * néanmoins poli (une requête par code postal, taille bornée).
 *
 * ATTENTION — l'ADEME renomme ses jeux de données et ses colonnes au fil des
 * millésimes. Tout ce qui peut bouger est isolé ci-dessous : `DATASET` est
 * surchargeable par variable d'environnement, et le mapping essaie plusieurs
 * noms de colonne par champ. Une colonne disparue dégrade le champ à null,
 * elle ne casse jamais le cron.
 */

import type { DpeLettre } from '@/types/bien';
import type { DpeRecent } from '@/lib/automations/veille-dpe';

const BASE = process.env.ADEME_API_BASE ?? 'https://data.ademe.fr/data-fair/api/v1/datasets';

/** Logements existants. Surchargeable sans redéploiement si l'ADEME renomme. */
const DATASET = process.env.ADEME_DPE_DATASET ?? 'dpe03existant';

/**
 * Les seuls réglages à toucher si la base change de vocabulaire.
 * Premier nom trouvé dans la ligne = valeur retenue.
 */
const CHAMPS = {
  numero: ['N°DPE', 'numero_dpe', 'N_DPE'],
  adresse: ['Adresse_(BAN)', 'adresse_ban', 'Adresse_brute', 'adresse_brute'],
  codePostal: ['Code_postal_(BAN)', 'code_postal_ban', 'Code_postal_(brut)', 'code_postal_brut'],
  commune: ['Nom__commune_(BAN)', 'nom_commune_ban', 'Nom_commune_(Brut)', 'commune'],
  date: ['Date_établissement_DPE', 'date_etablissement_dpe', 'Date_visite_diagnostiqueur'],
  lettre: ['Etiquette_DPE', 'etiquette_dpe', 'Classe_estimation_DPE'],
  surface: ['Surface_habitable_logement', 'surface_habitable_logement'],
  type: ['Type_bâtiment', 'type_batiment'],
  latitude: ['Coordonnée_cartographique_Y_(BAN)', 'latitude', '_geopoint'],
  longitude: ['Coordonnée_cartographique_X_(BAN)', 'longitude'],
} as const;

const LETTRES: readonly string[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

type Ligne = Record<string, unknown>;

function premier(ligne: Ligne, noms: readonly string[]): unknown {
  for (const nom of noms) {
    const v = ligne[nom];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return null;
}

function texte(ligne: Ligne, noms: readonly string[]): string | null {
  const v = premier(ligne, noms);
  return typeof v === 'string' ? v.trim() || null : v != null ? String(v) : null;
}

function nombre(ligne: Ligne, noms: readonly string[]): number | null {
  const v = premier(ligne, noms);
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v.replace(',', '.')) : NaN;
  return Number.isFinite(n) ? n : null;
}

function lettreDpe(ligne: Ligne): DpeLettre | null {
  const v = texte(ligne, CHAMPS.lettre)?.toUpperCase();
  return v && LETTRES.includes(v) ? (v as DpeLettre) : null;
}

/** `_geopoint` arrive parfois sous la forme « lat,lon ». */
function geopoint(ligne: Ligne): { lat: number | null; lon: number | null } {
  const raw = ligne['_geopoint'];
  if (typeof raw === 'string' && raw.includes(',')) {
    const [lat, lon] = raw.split(',').map((p) => Number(p.trim()));
    if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat: lat!, lon: lon! };
  }
  return { lat: null, lon: null };
}

/** Une ligne brute ADEME → le modèle du moteur. Rend null si inexploitable. */
export function mapLigneDpe(ligne: Ligne): DpeRecent | null {
  const numeroDpe = texte(ligne, CHAMPS.numero);
  const adresse = texte(ligne, CHAMPS.adresse);
  const dateEtablissement = texte(ligne, CHAMPS.date)?.slice(0, 10) ?? null;
  // Sans identifiant, sans adresse ou sans date, la ligne ne sert à rien :
  // on ne saurait ni dédupliquer, ni situer, ni dater le signal.
  if (!numeroDpe || !adresse || !dateEtablissement) return null;

  const geo = geopoint(ligne);

  return {
    numeroDpe,
    adresse,
    codePostal: texte(ligne, CHAMPS.codePostal),
    commune: texte(ligne, CHAMPS.commune),
    dateEtablissement,
    lettre: lettreDpe(ligne),
    surfaceM2: nombre(ligne, CHAMPS.surface),
    typeBatiment: texte(ligne, CHAMPS.type),
    latitude: nombre(ligne, CHAMPS.latitude) ?? geo.lat,
    longitude: nombre(ligne, CHAMPS.longitude) ?? geo.lon,
  };
}

export interface FetchDpeParams {
  codePostal: string;
  /** Date d'établissement minimale (YYYY-MM-DD). */
  depuis: string;
  /** Plafond de lignes ramenées. */
  taille?: number;
  signal?: AbortSignal;
}

function urlLignes(params: FetchDpeParams): string {
  const champDate = CHAMPS.date[0];
  const champCp = CHAMPS.codePostal[0];
  const qs = `${champCp}:"${params.codePostal}" AND ${champDate}:[${params.depuis} TO *]`;

  const url = new URL(`${BASE}/${DATASET}/lines`);
  url.searchParams.set('size', String(params.taille ?? 200));
  url.searchParams.set('qs', qs);
  url.searchParams.set('sort', `-${champDate}`);
  return url.toString();
}

/**
 * DPE d'un code postal établis depuis une date. Ne lève jamais : une veille
 * qui casse le cron ferait perdre les autres agences du passage.
 */
export async function fetchDpeRecents(params: FetchDpeParams): Promise<DpeRecent[]> {
  try {
    const res = await fetch(urlLignes(params), {
      headers: { accept: 'application/json' },
      signal: params.signal,
      cache: 'no-store',
    });
    if (!res.ok) {
      console.error('[ademe] réponse', res.status, params.codePostal);
      return [];
    }
    const body = (await res.json()) as { results?: unknown };
    if (!Array.isArray(body.results)) return [];

    const out: DpeRecent[] = [];
    for (const ligne of body.results) {
      if (typeof ligne !== 'object' || ligne === null) continue;
      const dpe = mapLigneDpe(ligne as Ligne);
      if (dpe) out.push(dpe);
    }
    return out;
  } catch (err) {
    console.error('[ademe] échec', params.codePostal, err);
    return [];
  }
}

/** Les DPE de tout un secteur, sans jamais paralléliser à outrance. */
export async function fetchDpeSecteur(
  codesPostaux: readonly string[],
  depuis: string,
  signal?: AbortSignal,
): Promise<DpeRecent[]> {
  const out: DpeRecent[] = [];
  for (const codePostal of codesPostaux) {
    out.push(...(await fetchDpeRecents({ codePostal, depuis, signal })));
  }
  return out;
}
