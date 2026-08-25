import type { LngLatBoundsTuple } from '@/lib/carte/bounds';

/** Inclinaison partagée — assez lisible en terrain, bâtiments visibles dès ~z15. */
export const MAP_3D_PITCH = 45;

/** Légère rotation pour la profondeur sans désorienter. */
export const MAP_3D_BEARING = -15;

/** Pitch max utilisable côté Static Images API — extrusions visibles dès ~z16. */
export const STATIC_MAP_PITCH = 58;

export function boundsCenter(bounds: LngLatBoundsTuple): { longitude: number; latitude: number } {
  const [[minLng, minLat], [maxLng, maxLat]] = bounds;
  return {
    longitude: (minLng + maxLng) / 2,
    latitude: (minLat + maxLat) / 2,
  };
}

/** Zoom approximatif pour l’API Static (position + pitch). */
export function zoomForBounds(
  bounds: LngLatBoundsTuple,
  width: number,
  height: number,
  padding = 20,
  pitchDeg = 0,
): number {
  const [[minLng, minLat], [maxLng, maxLat]] = bounds;
  const latMid = (minLat + maxLat) / 2;
  const latRad = (latMid * Math.PI) / 180;
  const lngSpan = Math.max(maxLng - minLng, 0.0005);
  const latSpan = Math.max(maxLat - minLat, 0.0005);
  const tile = 512;
  const zoomX = Math.log2((width - padding * 2) / (tile * (lngSpan / 360) * Math.cos(latRad)));
  const zoomY = Math.log2((height - padding * 2) / (tile * (latSpan / 360)));
  let zoom = Math.min(zoomX, zoomY) - 0.35;
  if (pitchDeg > 0) zoom -= 0.6 + (pitchDeg / 45) * 0.45;
  return Math.min(17, Math.max(11, zoom));
}

/**
 * Zoom pour l’aperçu statique incliné : assez serré pour voir les extrusions
 * (fill-extrusion Mapbox), sans passer en mini-carte interactive.
 */
export function staticPreviewZoom(
  bounds: LngLatBoundsTuple,
  width: number,
  height: number,
  padding = 16,
): number {
  const fit = zoomForBounds(bounds, width, height, padding, STATIC_MAP_PITCH);
  // streets-v12 n’extrude les bâtiments qu’à partir d’environ z15.5.
  return Math.min(17.4, Math.max(16, fit));
}

export function routeBearing(
  stops: readonly { latitude: number; longitude: number }[],
): number {
  if (stops.length < 2) return normalizeBearing(MAP_3D_BEARING);
  const first = stops[0]!;
  const last = stops[stops.length - 1]!;
  const φ1 = (first.latitude * Math.PI) / 180;
  const φ2 = (last.latitude * Math.PI) / 180;
  const Δλ = ((last.longitude - first.longitude) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return normalizeBearing((Math.atan2(y, x) * 180) / Math.PI);
}

function normalizeBearing(deg: number): number {
  return ((deg % 360) + 360) % 360;
}
