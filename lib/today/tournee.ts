/**
 * Alias legacy — la logique vit dans sortie.ts.
 */
import type { GeoCoord } from '@/lib/carte/coords';
import { TOURNEE_RADIUS_M } from './field';
import {
  buildSortie,
  buildTourneeFromSortie,
  clustersWithin,
  haversineM,
  orderNearestNeighbor,
  pathDistanceM,
  type LocatedTask,
  type SortieStop,
} from './sortie';

export type { LocatedTask };

export type Tournee = {
  keys: string[];
  ordered: LocatedTask[];
  distanceM: number;
};

export { haversineM, orderNearestNeighbor, clustersWithin, pathDistanceM };

export function buildTournee(
  tasks: readonly LocatedTask[],
  origin: GeoCoord | null,
  radiusM: number = TOURNEE_RADIUS_M,
): Tournee | null {
  if (tasks.length < 2) return null;
  const pseudoLeads = tasks.map((t) => ({
    id: t.key,
    status: 'nouveau' as const,
    assignedTo: null,
    latitude: t.latitude,
    longitude: t.longitude,
    address: t.address,
    score: 0,
    surfaceM2: null,
    etage: null,
    mainSignalLabel: null,
    notes: null,
    banId: null,
    postalCode: null,
  }));
  const plan = buildSortie(
    pseudoLeads as Parameters<typeof buildSortie>[0],
    '',
    origin,
    radiusM,
  );
  const tour = buildTourneeFromSortie(plan, 2);
  if (!tour) return null;
  return {
    keys: tour.ordered.map((s) => s.key),
    ordered: tour.ordered,
    distanceM: tour.distanceM,
  };
}

export function sortieStopsFromTasks(tasks: readonly LocatedTask[]): SortieStop[] {
  return tasks.map((t) => ({
    ...t,
    leadId: t.key,
    score: 0,
    surfaceM2: null,
    etage: null,
    mainSignalLabel: null,
    notes: null,
    banId: null,
    postalCode: null,
  }));
}
