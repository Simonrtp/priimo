import type { MapPoint, MapPointKind } from '@/lib/carte/points';

/** Prospect > Bien > Contact > Note. */
export const BUILDING_KIND_PRIORITY: Record<MapPointKind, number> = {
  lead: 0,
  bien: 1,
  contact: 2,
  note: 3,
};

export type MapPeriod = 30 | 90 | 365 | 'all';

export type MapViewport = {
  west: number;
  south: number;
  east: number;
  north: number;
};

export type BuildingMarker = {
  banId: string;
  latitude: number;
  longitude: number;
  postalCode: string | null;
  title: string;
  appearance: MapPoint;
  count: number;
  entities: MapPoint[];
};

export type MapListFilters = {
  kinds: ReadonlySet<MapPointKind>;
  postalCode: string | 'tous';
  assignedTo: string | 'tous';
  period: MapPeriod;
  now: number;
};

const DAY_MS = 86_400_000;

export function compareBuildingPriority(a: MapPoint, b: MapPoint): number {
  const byKind = BUILDING_KIND_PRIORITY[a.kind] - BUILDING_KIND_PRIORITY[b.kind];
  if (byKind !== 0) return byKind;
  if (a.kind === 'lead' && b.kind === 'lead') {
    return (b.score ?? 0) - (a.score ?? 0);
  }
  return Date.parse(b.occurredAt) - Date.parse(a.occurredAt);
}

export function pickBuildingAppearance(entities: readonly MapPoint[]): MapPoint {
  const first = entities[0];
  if (!first) {
    throw new Error('Un immeuble sans entité');
  }
  return [...entities].sort(compareBuildingPriority)[0] ?? first;
}

export function groupEntitiesByBanId(points: readonly MapPoint[]): BuildingMarker[] {
  const buckets = new Map<string, MapPoint[]>();
  for (const point of points) {
    const list = buckets.get(point.banId);
    if (list) list.push(point);
    else buckets.set(point.banId, [point]);
  }

  const buildings: BuildingMarker[] = [];
  for (const [banId, entities] of buckets) {
    const appearance = pickBuildingAppearance(entities);
    buildings.push({
      banId,
      latitude: appearance.latitude,
      longitude: appearance.longitude,
      postalCode: appearance.postalCode,
      title: appearance.title,
      appearance,
      count: entities.length,
      entities: [...entities].sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt)),
    });
  }
  return buildings;
}

export function filterMapEntities(
  points: readonly MapPoint[],
  filters: MapListFilters,
): MapPoint[] {
  const cutoff =
    filters.period === 'all' ? null : filters.now - filters.period * DAY_MS;

  return points.filter((point) => {
    if (!filters.kinds.has(point.kind)) return false;
    if (filters.postalCode !== 'tous' && point.postalCode !== filters.postalCode) {
      return false;
    }
    if (filters.assignedTo !== 'tous' && point.assignedTo !== filters.assignedTo) {
      return false;
    }
    if (cutoff !== null && Date.parse(point.occurredAt) < cutoff) return false;
    return true;
  });
}

export function pointInViewport(point: { latitude: number; longitude: number }, viewport: MapViewport): boolean {
  return (
    point.longitude >= viewport.west &&
    point.longitude <= viewport.east &&
    point.latitude >= viewport.south &&
    point.latitude <= viewport.north
  );
}

export function countKindsInViewport(
  points: readonly MapPoint[],
  viewport: MapViewport | null,
): Record<MapPointKind, number> {
  const counts: Record<MapPointKind, number> = {
    lead: 0,
    contact: 0,
    bien: 0,
    note: 0,
  };
  for (const point of points) {
    if (viewport && !pointInViewport(point, viewport)) continue;
    counts[point.kind] += 1;
  }
  return counts;
}

export function entitiesByKind(entities: readonly MapPoint[]): {
  kind: MapPointKind;
  label: string;
  items: MapPoint[];
}[] {
  const labels: Record<MapPointKind, string> = {
    lead: 'Prospects',
    bien: 'Biens',
    contact: 'Contacts',
    note: 'Notes terrain',
  };
  const order: MapPointKind[] = ['lead', 'bien', 'contact', 'note'];
  return order
    .map((kind) => ({
      kind,
      label: labels[kind],
      items: entities
        .filter((e) => e.kind === kind)
        .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt)),
    }))
    .filter((group) => group.items.length > 0);
}
