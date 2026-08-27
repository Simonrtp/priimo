import type { GeoCoord } from '@/lib/carte/coords';
import type { Lead } from '@/types/lead';
import { haversineM } from '@/lib/geo/distance';
import { loopDistanceM, optimizeLoopOrder } from './route-optimize';
import { TOURNEE_RADIUS_M } from './field';

export { haversineM };

export const MAX_SORTIE_STOPS = 10;

export type LocatedTask = {
  key: string;
  address: string;
  latitude: number;
  longitude: number;
};

export type SortieStop = LocatedTask & {
  leadId: string;
  score: number;
  surfaceM2: number | null;
  etage: string | null;
  mainSignalLabel: string | null;
  notes: string | null;
  banId: string | null;
  postalCode: string | null;
};

export type SortiePlan = {
  ordered: SortieStop[];
  distanceM: number;
  signature: string;
};

export type SortieProgress = {
  signature: string;
  done: string[];
  skipped: string[];
  dictees: string[];
};

const CLOSED_STATUSES = new Set(['mandat_signe', 'pas_interesse', 'vendeur_ailleurs']);

export function sortieStorageKey(profileId: string, day: string): string {
  return `priimo-sortie:${profileId}:${day}`;
}

/** @deprecated alias mobile — même clé que sortieStorageKey. */
export function tourneeStorageKey(profileId: string, day: string): string {
  return sortieStorageKey(profileId, day);
}

export function sortieSignature(stops: readonly Pick<LocatedTask, 'key'>[]): string {
  return [...stops.map((s) => s.key)].sort().join('|');
}

/** Au-delà, l'agent est considéré déjà sur le terrain. */
export const SORTIE_FIELD_ORIGIN_M = 500;

export function resolveSortieOrigin(
  agency: GeoCoord | null,
  gps: GeoCoord | null,
): { origin: GeoCoord | null; source: 'agency' | 'field' | 'none' } {
  if (!agency && !gps) return { origin: null, source: 'none' };
  if (!agency) return { origin: gps, source: 'field' };
  if (!gps) return { origin: agency, source: 'agency' };
  if (haversineM(agency, gps) > SORTIE_FIELD_ORIGIN_M) {
    return { origin: gps, source: 'field' };
  }
  return { origin: agency, source: 'agency' };
}

function asCoord(t: LocatedTask): GeoCoord {
  return { latitude: t.latitude, longitude: t.longitude };
}

export function clustersWithin(
  tasks: readonly LocatedTask[],
  radiusM: number,
): LocatedTask[][] {
  const n = tasks.length;
  if (n === 0) return [];
  const parent = Array.from({ length: n }, (_, i) => i);

  function find(i: number): number {
    let x = i;
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]!]!;
      x = parent[x]!;
    }
    return x;
  }
  function union(a: number, b: number) {
    const pa = find(a);
    const pb = find(b);
    if (pa !== pb) parent[pa] = pb;
  }

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (haversineM(asCoord(tasks[i]!), asCoord(tasks[j]!)) <= radiusM) union(i, j);
    }
  }

  const groups = new Map<number, LocatedTask[]>();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    const list = groups.get(root) ?? [];
    list.push(tasks[i]!);
    groups.set(root, list);
  }
  return [...groups.values()];
}

export function orderNearestNeighbor(
  tasks: readonly LocatedTask[],
  origin: GeoCoord | null,
): LocatedTask[] {
  if (tasks.length === 0) return [];
  const remaining = [...tasks];
  const ordered: LocatedTask[] = [];
  let current: GeoCoord;

  if (origin) {
    current = origin;
  } else {
    const first = remaining.shift()!;
    ordered.push(first);
    current = asCoord(first);
  }

  while (remaining.length > 0) {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineM(current, asCoord(remaining[i]!));
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    const next = remaining.splice(best, 1)[0]!;
    ordered.push(next);
    current = asCoord(next);
  }
  return ordered;
}

export function pathDistanceM(ordered: readonly LocatedTask[], origin: GeoCoord | null): number {
  if (ordered.length === 0) return 0;
  let total = 0;
  let prev: GeoCoord = origin ?? asCoord(ordered[0]!);
  const start = origin ? 0 : 1;
  for (let i = start; i < ordered.length; i++) {
    const stop = ordered[i]!;
    total += haversineM(prev, asCoord(stop));
    prev = asCoord(stop);
  }
  return total;
}

export function isLeadForSortie(lead: Pick<Lead, 'status' | 'assignedTo'>, profileId: string): boolean {
  if (CLOSED_STATUSES.has(lead.status)) return false;
  if (profileId && lead.assignedTo && lead.assignedTo !== profileId) return false;
  return true;
}

export function leadToSortieStop(lead: Lead): SortieStop | null {
  if (lead.latitude == null || lead.longitude == null) return null;
  return {
    key: lead.id,
    leadId: lead.id,
    address: lead.address,
    latitude: lead.latitude,
    longitude: lead.longitude,
    score: lead.score,
    surfaceM2: lead.surfaceM2,
    etage: lead.etage,
    mainSignalLabel: lead.mainSignalLabel,
    notes: lead.notes,
    banId: lead.banId,
    postalCode: lead.postalCode,
  };
}

function selectPool(
  stops: readonly SortieStop[],
  origin: GeoCoord | null,
  radiusM: number,
): SortieStop[] {
  if (stops.length === 0) return [];
  const tasks: LocatedTask[] = stops.map((s) => ({
    key: s.key,
    address: s.address,
    latitude: s.latitude,
    longitude: s.longitude,
  }));
  const clusters = clustersWithin(tasks, radiusM)
    .filter((c) => c.length >= 2)
    .sort((a, b) => b.length - a.length);
  const best = clusters[0];
  if (best) {
    const keys = new Set(best.map((t) => t.key));
    return stops.filter((s) => keys.has(s.key));
  }

  if (stops.length === 0) return [];
  const anchor = origin ?? asCoord(stops[0]!);
  let nearest = stops[0]!;
  let bestD = Infinity;
  for (const s of stops) {
    const d = haversineM(anchor, asCoord(s));
    if (d < bestD) {
      bestD = d;
      nearest = s;
    }
  }
  return [nearest];
}

/**
 * Sélectionne jusqu'à 10 adresses non travaillées, regroupées par proximité.
 * Le plus proche voisin choisit *lesquelles* ; l'optimiseur choisit l'ordre
 * de la boucle (départ → arrêts → départ) et la distance annoncée.
 */
export function buildSortie(
  leads: readonly Lead[],
  profileId: string,
  origin: GeoCoord | null,
  radiusM: number = TOURNEE_RADIUS_M,
): SortiePlan | null {
  const stops = leads
    .filter((l) => isLeadForSortie(l, profileId))
    .map(leadToSortieStop)
    .filter((s): s is SortieStop => s !== null);

  if (stops.length === 0) return null;

  const pool = selectPool(stops, origin, radiusM);
  const anchor = origin ?? (pool[0] ? asCoord(pool[0]) : null);
  const retained = orderNearestNeighbor(pool, anchor)
    .slice(0, MAX_SORTIE_STOPS)
    .map((t) => pool.find((s) => s.key === t.key)!)
    .filter(Boolean);

  if (retained.length === 0) return null;

  const ordered = optimizeLoopOrder(retained, anchor);

  return {
    ordered,
    distanceM: loopDistanceM(ordered, anchor),
    signature: sortieSignature(ordered),
  };
}

/** Tournée mobile : au moins 2 arrêts dans un même cluster. */
export function buildTourneeFromSortie(
  plan: SortiePlan | null,
  minStops = 2,
): SortiePlan | null {
  if (!plan || plan.ordered.length < minStops) return null;
  return plan;
}

export function lineGeoJson(
  stops: readonly { latitude: number; longitude: number }[],
): GeoJSON.Feature<GeoJSON.LineString> {
  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'LineString',
      coordinates: stops.map((s) => [s.longitude, s.latitude]),
    },
  };
}
