import type { RoutePoint } from '@/lib/today/directions';

/**
 * Optimization API v1 (Mapbox) : vrai voyageur de commerce sur le réseau
 * piéton, retour au point de départ. Plafonné à 12 coordonnées par appel.
 */
export const MAX_TRIP_COORDS = 12;

export type OptimizedTrip = {
  geometry: GeoJSON.LineString;
  distanceM: number;
  durationS: number;
  /** Ordre de visite : `order[position]` = index d'entrée. Commence par 0 (le départ). */
  order: number[];
};

export function optimizedTripUrl(points: readonly RoutePoint[], token: string): string {
  const coords = points
    .slice(0, MAX_TRIP_COORDS)
    .map((p) => `${p.longitude},${p.latitude}`)
    .join(';');
  const params = new URLSearchParams({
    geometries: 'geojson',
    overview: 'full',
    roundtrip: 'true',
    source: 'first',
    destination: 'any',
    access_token: token,
  });
  return `https://api.mapbox.com/optimized-trips/v1/mapbox/walking/${coords}?${params.toString()}`;
}

/** `waypoint_index` donne la place de chaque coordonnée d'entrée dans le trajet. */
export function parseOptimizedTrip(payload: unknown, expectedCount: number): OptimizedTrip | null {
  if (!payload || typeof payload !== 'object') return null;
  const data = payload as {
    code?: unknown;
    trips?: { geometry?: unknown; distance?: unknown; duration?: unknown }[];
    waypoints?: { waypoint_index?: unknown }[];
  };
  if (typeof data.code === 'string' && data.code !== 'Ok') return null;

  const trip = data.trips?.[0];
  const geometry = trip?.geometry as GeoJSON.LineString | undefined;
  if (!geometry || geometry.type !== 'LineString' || !Array.isArray(geometry.coordinates)) {
    return null;
  }

  const waypoints = data.waypoints;
  if (!Array.isArray(waypoints) || waypoints.length !== expectedCount) return null;

  const order = new Array<number>(expectedCount).fill(-1);
  for (let i = 0; i < waypoints.length; i++) {
    const position = waypoints[i]?.waypoint_index;
    if (typeof position !== 'number' || !Number.isInteger(position)) return null;
    if (position < 0 || position >= expectedCount) return null;
    if (order[position] !== -1) return null;
    order[position] = i;
  }
  if (order.some((i) => i < 0)) return null;

  return {
    geometry,
    distanceM: typeof trip?.distance === 'number' ? trip.distance : 0,
    durationS: typeof trip?.duration === 'number' ? trip.duration : 0,
    order,
  };
}

export async function fetchOptimizedTrip(
  points: readonly RoutePoint[],
  token: string,
): Promise<OptimizedTrip | null> {
  if (points.length < 2 || points.length > MAX_TRIP_COORDS || !token) return null;
  let res: Response;
  try {
    res = await fetch(optimizedTripUrl(points, token));
  } catch {
    return null;
  }
  if (!res.ok) return null;
  try {
    return parseOptimizedTrip(await res.json(), points.length);
  } catch {
    return null;
  }
}

/**
 * Réordonne les arrêts selon le trajet optimisé.
 * `points` = [départ, ...arrêts] — la première position est le départ, on la retire.
 */
export function applyTripOrder<T>(stops: readonly T[], trip: OptimizedTrip): T[] | null {
  if (trip.order.length !== stops.length + 1) return null;
  if (trip.order[0] !== 0) return null;
  const ordered: T[] = [];
  for (let position = 1; position < trip.order.length; position++) {
    const stop = stops[trip.order[position]! - 1];
    if (!stop) return null;
    ordered.push(stop);
  }
  return ordered;
}
