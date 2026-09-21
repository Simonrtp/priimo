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
 * Les clés snake_case sont celles du jeu data-fair actuel.
 */
const CHAMPS = {
  numero: ['numero_dpe', 'N°DPE', 'N_DPE'],
  adresse: ['adresse_ban', 'Adresse_(BAN)', 'adresse_brute', 'Adresse_brute'],
  codePostal: ['code_postal_ban', 'Code_postal_(BAN)', 'code_postal_brut', 'Code_postal_(brut)'],
  commune: ['nom_commune_ban', 'Nom__commune_(BAN)', 'Nom_commune_(Brut)', 'commune'],
  date: [
    'date_etablissement_dpe',
    'Date_établissement_DPE',
    'date_visite_diagnostiqueur',
    'Date_visite_diagnostiqueur',
  ],
  lettre: ['etiquette_dpe', 'Etiquette_DPE', 'Classe_estimation_DPE'],
  surface: ['surface_habitable_logement', 'Surface_habitable_logement'],
  type: ['type_batiment', 'Type_bâtiment'],
  etage: ['numero_etage_appartement', 'etage'],
  ban: ['identifiant_ban', 'ban_id'],
  latitude: ['latitude', '_geopoint'],
  longitude: ['longitude'],
} as const;

/** Variantes de requête : le jeu actuel, puis l’ancien millésime accentué. */
const QUERY_VARIANTS = [
  { date: 'date_etablissement_dpe', cp: 'code_postal_ban' },
  { date: 'Date_établissement_DPE', cp: 'Code_postal_(BAN)' },
] as const;

const LETTRES: readonly string[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
const ADEME_HEADERS = {
  accept: 'application/json',
  'user-agent': 'Priimo/1.0 (cadastre-dpe)',
} as const;

const CACHE_TTL_MS = 15 * 60 * 1000;
const cache = new Map<string, { at: number; rows: DpeRecent[] }>();

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
    identifiantBan: texte(ligne, CHAMPS.ban),
    lettre: lettreDpe(ligne),
    surfaceM2: nombre(ligne, CHAMPS.surface),
    etage: nombre(ligne, CHAMPS.etage),
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

export function ademeLinesUrl(
  params: FetchDpeParams,
  champs: { date: string; cp: string } = QUERY_VARIANTS[0],
): string {
  const qs = `${champs.cp}:"${params.codePostal}" AND ${champs.date}:[${params.depuis} TO *]`;
  const url = new URL(`${BASE}/${DATASET}/lines`);
  url.searchParams.set('size', String(Math.min(params.taille ?? 200, 5000)));
  url.searchParams.set('qs', qs);
  url.searchParams.set('sort', `-${champs.date}`);
  return url.toString();
}

function parseResults(body: unknown): DpeRecent[] {
  if (!body || typeof body !== 'object') return [];
  const results = (body as { results?: unknown }).results;
  if (!Array.isArray(results)) return [];
  const out: DpeRecent[] = [];
  for (const ligne of results) {
    if (typeof ligne !== 'object' || ligne === null) continue;
    const dpe = mapLigneDpe(ligne as Ligne);
    if (dpe) out.push(dpe);
  }
  return out;
}

async function fetchPage(url: string, signal?: AbortSignal): Promise<{
  rows: DpeRecent[];
  next: string | null;
  ok: boolean;
}> {
  const res = await fetch(url, {
    headers: ADEME_HEADERS,
    signal,
    cache: 'no-store',
  });
  const text = await res.text();
  if (!res.ok) {
    console.error('[ademe] réponse', res.status, url.slice(0, 180));
    return { rows: [], next: null, ok: false };
  }
  try {
    const body = JSON.parse(text) as { results?: unknown; next?: unknown };
    const next = typeof body.next === 'string' && body.next.startsWith('http') ? body.next : null;
    return { rows: parseResults(body), next, ok: true };
  } catch {
    console.error('[ademe] json', text.slice(0, 180));
    return { rows: [], next: null, ok: false };
  }
}

/**
 * DPE d'un code postal établis depuis une date. Ne lève jamais : une veille
 * qui casse le cron ferait perdre les autres agences du passage.
 */
export async function fetchDpeRecents(params: FetchDpeParams): Promise<DpeRecent[]> {
  const plafond = params.taille ?? 200;
  try {
    for (const champs of QUERY_VARIANTS) {
      const first = await fetchPage(ademeLinesUrl(params, champs), params.signal);
      if (!first.ok) continue;
      const out = [...first.rows];
      let next = first.next;
      while (next && out.length < plafond) {
        const page = await fetchPage(next, params.signal);
        if (!page.ok) break;
        out.push(...page.rows);
        next = page.next;
        if (page.rows.length === 0) break;
      }
      return out.slice(0, plafond);
    }
    return [];
  } catch (err) {
    console.error('[ademe] échec', params.codePostal, err);
    return [];
  }
}

export async function fetchDpeRecentsCached(params: FetchDpeParams): Promise<DpeRecent[]> {
  const key = `${params.codePostal}|${params.depuis}|${params.taille ?? 200}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.rows;
  const rows = await fetchDpeRecents(params);
  cache.set(key, { at: Date.now(), rows });
  return rows;
}

/** Les DPE de tout un secteur, sans jamais paralléliser à outrance. */
export async function fetchDpeSecteur(
  codesPostaux: readonly string[],
  depuis: string,
  signal?: AbortSignal,
  opts?: { taille?: number; cached?: boolean },
): Promise<DpeRecent[]> {
  const out: DpeRecent[] = [];
  const fetchOne = opts?.cached ? fetchDpeRecentsCached : fetchDpeRecents;
  for (const codePostal of codesPostaux) {
    out.push(...(await fetchOne({ codePostal, depuis, signal, taille: opts?.taille })));
  }
  return out;
}
