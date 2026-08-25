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
