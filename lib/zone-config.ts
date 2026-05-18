export const ZONE_RADIUS_KM_MIN = 1;
export const ZONE_RADIUS_KM_MAX = 15;
export const ZONE_RADIUS_KM_DEFAULT = 2;

export function clampZoneRadiusKm(value: number): number {
  return Math.min(ZONE_RADIUS_KM_MAX, Math.max(ZONE_RADIUS_KM_MIN, value));
}
