import { haversineM } from '@/lib/today/sortie';

export const MAX_DIRECTIONS_WAYPOINTS = 25;
/** Au-delà, le GPS n’est plus un départ de tournée (agence trop loin, cache périmé). */
export const ORIGIN_MAX_M = 5_000;
export const CARTE_ITINERAIRE_HREF = '/dashboard/prospection?vue=carte&itineraire=1';
/** Ouvre la carte et lance la séquence de tournée. */
export const CARTE_TOURNEE_HREF = '/dashboard/prospection?vue=carte&tournee=1';

export type RoutePoint = {
  latitude: number;
  longitude: number;
};

export type ItineraireStop = RoutePoint & {
  address: string;
  leadId: string;
  banId: string | null;
};

export type WalkingRoute = {
  geometry: GeoJSON.LineString;
  distanceM: number;
  durationS: number;
};

const STORAGE_KEY = 'priimo-itineraire-stops';

export function routeWaypoints(
  stops: readonly RoutePoint[],
  origin: RoutePoint | null,
): RoutePoint[] {
  if (stops.length === 0) return [];
  const first = stops[0]!;
  if (origin && haversineM(origin, first) <= ORIGIN_MAX_M) {
    return [origin, ...stops].slice(0, MAX_DIRECTIONS_WAYPOINTS);
  }
  return [...stops].slice(0, MAX_DIRECTIONS_WAYPOINTS);
}

export function directionsRequestUrl(points: readonly RoutePoint[], token: string): string {
  const coords = points
    .slice(0, MAX_DIRECTIONS_WAYPOINTS)
    .map((p) => `${p.longitude},${p.latitude}`)
    .join(';');
  const params = new URLSearchParams({
    geometries: 'geojson',
    overview: 'full',
    access_token: token,
  });
  return `https://api.mapbox.com/directions/v5/mapbox/walking/${coords}?${params.toString()}`;
}

export async function fetchWalkingRoute(
  points: readonly RoutePoint[],
  token: string,
): Promise<WalkingRoute | null> {
  if (points.length < 2 || !token) return null;
  let res: Response;
  try {
    res = await fetch(directionsRequestUrl(points, token));
  } catch {
    return null;
  }
  if (!res.ok) return null;
  const data = (await res.json()) as {
    routes?: { geometry?: GeoJSON.LineString; distance?: number; duration?: number }[];
  };
  const route = data.routes?.[0];
  const geometry = route?.geometry;
  if (!geometry || geometry.type !== 'LineString' || !Array.isArray(geometry.coordinates)) {
    return null;
  }
  return {
    geometry,
    distanceM: typeof route.distance === 'number' ? route.distance : 0,
    durationS: typeof route.duration === 'number' ? route.duration : 0,
  };
}

export function googleMapsWalkingUrl(points: readonly RoutePoint[]): string {
  if (points.length === 0) return 'https://www.google.com/maps';
  if (points.length === 1) {
    const p = points[0]!;
    return `https://www.google.com/maps/dir/?api=1&destination=${p.latitude},${p.longitude}&travelmode=walking`;
  }
  const origin = points[0]!;
  const dest = points[points.length - 1]!;
  const middle = points.slice(1, -1).slice(0, 9);
  const params = new URLSearchParams({
    api: '1',
    origin: `${origin.latitude},${origin.longitude}`,
    destination: `${dest.latitude},${dest.longitude}`,
    travelmode: 'walking',
  });
  if (middle.length > 0) {
    params.set('waypoints', middle.map((p) => `${p.latitude},${p.longitude}`).join('|'));
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function formatWalkingDuration(seconds: number): string {
  const m = Math.max(1, Math.round(seconds / 60));
  return `${m} min`;
}

export function writeItineraireStops(stops: readonly ItineraireStop[]): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stops));
  } catch {
    // quota / mode privé
  }
}

export function readItineraireStops(): ItineraireStop[] | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length < 2) return null;
    const stops: ItineraireStop[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      if (typeof row.latitude !== 'number' || typeof row.longitude !== 'number') return null;
      if (typeof row.address !== 'string' || typeof row.leadId !== 'string') return null;
      stops.push({
        latitude: row.latitude,
        longitude: row.longitude,
        address: row.address,
        leadId: row.leadId,
        banId: typeof row.banId === 'string' ? row.banId : null,
      });
    }
    return stops.length >= 2 ? stops : null;
  } catch {
    return null;
  }
}

export function toItineraireStops(
  stops: readonly {
    latitude: number;
    longitude: number;
    address: string;
    leadId: string;
    banId: string | null;
  }[],
): ItineraireStop[] {
  return stops.map((s) => ({
    latitude: s.latitude,
    longitude: s.longitude,
    address: s.address,
    leadId: s.leadId,
    banId: s.banId,
  }));
}
