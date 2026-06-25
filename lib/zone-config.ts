export const ZONE_RADIUS_KM_MIN = 1;
export const ZONE_RADIUS_KM_MAX = 10;
export const ZONE_RADIUS_KM_DEFAULT = 2;
export const ZONE_RADIUS_KM_STEP = 0.5;

export function clampZoneRadiusKm(value: number): number {
  const clamped = Math.min(ZONE_RADIUS_KM_MAX, Math.max(ZONE_RADIUS_KM_MIN, value));
  return Math.round(clamped / ZONE_RADIUS_KM_STEP) * ZONE_RADIUS_KM_STEP;
}
