import type { BuildingMarker } from '@/lib/carte/buildings';
import type { MapPoint, MapPointKind } from '@/lib/carte/points';

const CLUSTER_PX = 52;
const DISABLE_CLUSTERING_AT_ZOOM = 16;

/** Décalage en degrés (~8–10 m) pour ne pas empiler contact / bien sur le prospect. */
const KIND_OFFSET: Record<MapPointKind, { dLat: number; dLng: number }> = {
  lead: { dLat: 0, dLng: 0 },
  contact: { dLat: 0.00007, dLng: 0 },
  bien: { dLat: 0, dLng: 0.0001 },
  note: { dLat: -0.00007, dLng: 0 },
};

export function pointDisplayCoord(point: MapPoint): { latitude: number; longitude: number } {
  const offset = KIND_OFFSET[point.kind];
  return {
    latitude: point.latitude + offset.dLat,
    longitude: point.longitude + offset.dLng,
  };
}

export type ClusteredPoint = { kind: 'point'; point: MapPoint };
export type ClusteredGroup = {
  kind: 'cluster';
  id: string;
  latitude: number;
  longitude: number;
  count: number;
  children: MapPoint[];
};
export type ClusteredItem = ClusteredPoint | ClusteredGroup;

function project(lng: number, lat: number, zoom: number): { x: number; y: number } {
  const scale = 256 * 2 ** zoom;
  const x = ((lng + 180) / 360) * scale;
  const sin = Math.sin((lat * Math.PI) / 180);
  const y = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale;
  return { x, y };
}

function clusterGroup(points: readonly MapPoint[], zoom: number): ClusteredItem[] {
  if (points.length === 0) return [];
  if (zoom >= DISABLE_CLUSTERING_AT_ZOOM || points.length === 1) {
    return points.map((point) => ({ kind: 'point' as const, point }));
  }

  const buckets = new Map<string, MapPoint[]>();
  for (const point of points) {
    const display = pointDisplayCoord(point);
    const { x, y } = project(display.longitude, display.latitude, zoom);
    const key = `${Math.floor(x / CLUSTER_PX)}:${Math.floor(y / CLUSTER_PX)}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(point);
    else buckets.set(key, [point]);
  }

  const items: ClusteredItem[] = [];
  for (const [key, bucket] of buckets) {
    const first = bucket[0];
    if (!first) continue;
    if (bucket.length === 1) {
      items.push({ kind: 'point', point: first });
      continue;
    }
    let lat = 0;
    let lng = 0;
    for (const point of bucket) {
      const display = pointDisplayCoord(point);
      lat += display.latitude;
      lng += display.longitude;
    }
    items.push({
      kind: 'cluster',
      id: `cluster:${key}`,
      latitude: lat / bucket.length,
      longitude: lng / bucket.length,
      count: bucket.length,
      children: bucket,
    });
  }
  return items;
}

/** Les prospects restent chacun visibles ; seuls contacts et biens se regroupent. */
export function clusterMapPoints(points: readonly MapPoint[], zoom: number): ClusteredItem[] {
  const leads: ClusteredItem[] = [];
  const others: MapPoint[] = [];
  for (const point of points) {
    if (point.kind === 'lead') leads.push({ kind: 'point', point });
    else others.push(point);
  }
  return [...clusterGroup(others, zoom), ...leads];
}

export type ClusteredBuilding =
  | { kind: 'building'; building: BuildingMarker }
  | {
      kind: 'cluster';
      id: string;
      latitude: number;
      longitude: number;
      count: number;
      children: BuildingMarker[];
    };

/** Toutes les couches, en dessous du zoom 16. Un immeuble reste un marqueur. */
export function clusterBuildings(
  buildings: readonly BuildingMarker[],
  zoom: number,
): ClusteredBuilding[] {
  if (buildings.length === 0) return [];
  if (zoom >= DISABLE_CLUSTERING_AT_ZOOM || buildings.length === 1) {
    return buildings.map((building) => ({ kind: 'building' as const, building }));
  }

  const buckets = new Map<string, BuildingMarker[]>();
  for (const building of buildings) {
    const { x, y } = project(building.longitude, building.latitude, zoom);
    const key = `${Math.floor(x / CLUSTER_PX)}:${Math.floor(y / CLUSTER_PX)}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(building);
    else buckets.set(key, [building]);
  }

  const items: ClusteredBuilding[] = [];
  for (const [key, bucket] of buckets) {
    const first = bucket[0];
    if (!first) continue;
    if (bucket.length === 1) {
      items.push({ kind: 'building', building: first });
      continue;
    }
    let lat = 0;
    let lng = 0;
    for (const building of bucket) {
      lat += building.latitude;
      lng += building.longitude;
    }
    items.push({
      kind: 'cluster',
      id: `bcluster:${key}`,
      latitude: lat / bucket.length,
      longitude: lng / bucket.length,
      count: bucket.length,
      children: bucket,
    });
  }
  return items;
}
