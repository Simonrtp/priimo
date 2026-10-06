/**
 * Base Adresse Nationale — les voies et leurs numéros, pour les règles de
 * secteur du type « rue Oberkampf, côté pair, du 2 au 40 ».
 *
 * Recherche : api-adresse (type=street). Numéros : la fiche de la voie sur
 * plateforme.adresse.data.gouv.fr, qui donne chaque numéro avec sa position
 * et ses parcelles. Les deux API sont publiques, sans clé.
 */
import { memeVoie, normaliserVoie } from '@/lib/zones/adresse';

const RECHERCHE = 'https://api-adresse.data.gouv.fr/search/';
const FICHE_VOIE = 'https://plateforme.adresse.data.gouv.fr/lookup/';
const DELAI_MS = 8_000;
const MEMOIRE_MS = 24 * 60 * 60 * 1000;
const MEMOIRE_MAX = 300;

export type VoieTrouvee = {
  /** Clé d'interopérabilité de la voie (« 75111_6858 »). */
  id: string;
  nom: string;
  codePostal: string;
  commune: string;
  latitude: number;
  longitude: number;
};

export type NumeroVoie = {
  numero: number;
  suffixe: string | null;
  longitude: number;
  latitude: number;
  /** Parcelles cadastrales du numéro (identifiants à 14 caractères). */
  parcelles: string[];
};

function texte(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/** Pur : réponse de recherche BAN → voies. */
export function lireVoies(body: unknown): VoieTrouvee[] {
  const features = (body as { features?: unknown[] } | null)?.features;
  if (!Array.isArray(features)) return [];
  const out: VoieTrouvee[] = [];
  for (const f of features) {
    const props = (f as { properties?: Record<string, unknown> }).properties ?? {};
    const coords = (f as { geometry?: { coordinates?: unknown } }).geometry?.coordinates;
    if (props.type !== 'street' || !Array.isArray(coords)) continue;
    const [longitude, latitude] = coords as number[];
    const id = texte(props.id);
    const nom = texte(props.name);
    const codePostal = texte(props.postcode);
    if (!id || !nom || !/^\d{5}$/.test(codePostal)) continue;
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) continue;
    out.push({ id, nom, codePostal, commune: texte(props.city), latitude: latitude!, longitude: longitude! });
  }
  return out;
}

/** Pur : fiche d'une voie → ses numéros situés. */
export function lireNumeros(body: unknown): NumeroVoie[] {
  const numeros = (body as { numeros?: unknown[] } | null)?.numeros;
  if (!Array.isArray(numeros)) return [];
  const out: NumeroVoie[] = [];
  for (const n of numeros) {
    const row = n as Record<string, unknown>;
    const numero = Number(row.numero);
    const coords = (row.position as { coordinates?: unknown } | undefined)?.coordinates;
    if (!Number.isInteger(numero) || numero <= 0 || !Array.isArray(coords)) continue;
    const [longitude, latitude] = coords as number[];
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) continue;
    out.push({
      numero,
      suffixe: texte(row.suffixe) || null,
      longitude: longitude!,
      latitude: latitude!,
      parcelles: Array.isArray(row.parcelles)
        ? row.parcelles.filter((p): p is string => typeof p === 'string' && p.length === 14)
        : [],
    });
  }
  return out;
}

async function lireJson(url: string): Promise<unknown> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), DELAI_MS);
  try {
    const res = await fetch(url, {
      signal: ac.signal,
      headers: { accept: 'application/json' },
      cache: 'no-store',
    });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export async function chercherVoies(
  q: string,
  opts: { proche?: { latitude: number; longitude: number } | null; codePostal?: string | null; limite?: number } = {},
): Promise<VoieTrouvee[]> {
  const requete = q.trim();
  if (requete.length < 3) return [];
  const url = new URL(RECHERCHE);
  url.searchParams.set('q', requete);
  url.searchParams.set('type', 'street');
  url.searchParams.set('limit', String(opts.limite ?? 6));
  url.searchParams.set('autocomplete', '1');
  if (opts.codePostal && /^\d{5}$/.test(opts.codePostal)) url.searchParams.set('postcode', opts.codePostal);
  if (opts.proche) {
    url.searchParams.set('lat', opts.proche.latitude.toFixed(5));
    url.searchParams.set('lon', opts.proche.longitude.toFixed(5));
  }
  return lireVoies(await lireJson(url.toString()));
}

const memoire = new Map<string, { expire: number; numeros: NumeroVoie[] }>();

/**
 * Les numéros d'une voie, retrouvée par son nom et son code postal (c'est ce
 * que la règle enregistre). Gardés une journée en mémoire.
 */
export async function numerosDeLaVoie(voie: { nom: string; codePostal: string }): Promise<NumeroVoie[]> {
  const cle = `${normaliserVoie(voie.nom)}|${voie.codePostal}`;
  const connue = memoire.get(cle);
  if (connue && connue.expire > Date.now()) return connue.numeros;

  const candidates = await chercherVoies(voie.nom, { codePostal: voie.codePostal, limite: 5 });
  const retenue = candidates.find((c) => memeVoie(c.nom, voie.nom)) ?? null;
  if (!retenue) return [];
  const numeros = lireNumeros(await lireJson(`${FICHE_VOIE}${encodeURIComponent(retenue.id)}`));

  if (memoire.size >= MEMOIRE_MAX) {
    const plusAncienne = memoire.keys().next().value;
    if (plusAncienne !== undefined) memoire.delete(plusAncienne);
  }
  memoire.set(cle, { expire: Date.now() + MEMOIRE_MS, numeros });
  return numeros;
}
