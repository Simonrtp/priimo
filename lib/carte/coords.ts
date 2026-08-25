export type GeoCoord = { latitude: number; longitude: number };

/** Coordonnées déjà en base, assez fiables pour un point sur la carte. */
export function toGeoCoord(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
): GeoCoord | null {
  if (
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180 ||
    (latitude === 0 && longitude === 0)
  ) {
    return null;
  }
  return { latitude, longitude };
}

export function isUsableCoord(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
): boolean {
  return toGeoCoord(latitude, longitude) !== null;
}
