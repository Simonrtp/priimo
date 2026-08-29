import { geocodeAdresse, type BanGeocodeCache } from '@/lib/geo/ban';

export type BanGeoColumns = {
  ban_id: string | null;
  latitude: number | null;
  longitude: number | null;
  adresse_normalisee: string | null;
  geocode_score: number | null;
  geocode_le: string | null;
};

export const EMPTY_BAN_GEO: BanGeoColumns = {
  ban_id: null,
  latitude: null,
  longitude: null,
  adresse_normalisee: null,
  geocode_score: null,
  geocode_le: null,
};

/**
 * Coordonnées déjà fournies par le client (sélection BAN).
 * Évite un second aller-retour à l’API adresse à l’enregistrement.
 */
export function parseClientGeo(raw: Record<string, unknown>): BanGeoColumns | null {
  const lat =
    typeof raw.latitude === 'number'
      ? raw.latitude
      : typeof raw.latitude === 'string'
        ? Number(raw.latitude)
        : NaN;
  const lng =
    typeof raw.longitude === 'number'
      ? raw.longitude
      : typeof raw.longitude === 'string'
        ? Number(raw.longitude)
        : NaN;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;

  const banId =
    typeof raw.banId === 'string' && raw.banId.trim()
      ? raw.banId.trim()
      : typeof raw.ban_id === 'string' && raw.ban_id.trim()
        ? raw.ban_id.trim()
        : null;

  const label =
    typeof raw.adresseNormalisee === 'string' && raw.adresseNormalisee.trim()
      ? raw.adresseNormalisee.trim()
      : typeof raw.address === 'string' && raw.address.trim()
        ? raw.address.trim()
        : null;

  return {
    ban_id: banId,
    latitude: lat,
    longitude: lng,
    adresse_normalisee: label,
    geocode_score: 1,
    geocode_le: new Date().toISOString(),
  };
}

/** Préfère le géocode client ; sinon appelle la BAN. */
export async function resolveGeoColumns(
  raw: Record<string, unknown>,
  adresse: string | null | undefined,
  codePostal?: string | null,
  cache?: BanGeocodeCache,
): Promise<BanGeoColumns> {
  const client = parseClientGeo(raw);
  if (client) return client;
  return geocodeToColumns(adresse, codePostal, cache);
}

/** Jamais d'exception : un échec BAN n'empêche pas d'enregistrer la fiche. */
export async function geocodeToColumns(
  adresse: string | null | undefined,
  codePostal?: string | null,
  cache?: BanGeocodeCache,
): Promise<BanGeoColumns> {
  const query = (adresse ?? '').trim();
  if (query.length < 3) return { ...EMPTY_BAN_GEO };

  try {
    const hit = await geocodeAdresse(query, codePostal?.trim() || undefined, cache);
    if (!hit) return { ...EMPTY_BAN_GEO };
    return {
      ban_id: hit.ban_id,
      latitude: hit.lat,
      longitude: hit.lng,
      adresse_normalisee: hit.adresse_normalisee,
      geocode_score: hit.score,
      geocode_le: new Date().toISOString(),
    };
  } catch {
    return { ...EMPTY_BAN_GEO };
  }
}

export function contactGeocodeQuery(
  address: string | null | undefined,
  secteur: string | null | undefined,
  postalCodes: readonly string[] | null | undefined,
): { adresse: string; codePostal?: string } | null {
  const codePostal = postalCodes?.find((c) => /^\d{5}$/.test(c));
  const adresse = (address ?? '').trim() || (secteur ?? '').trim();
  if (adresse.length < 3) return null;
  return { adresse, codePostal };
}
