import type { GeoCoord } from '@/lib/carte/coords';
import {
  haversineM,
  sortieSignature,
  type SortiePlan,
  type SortieProgress,
  type SortieStop,
} from '@/lib/today/sortie';
import { loopDistanceM, optimizeLoopOrder } from '@/lib/today/route-optimize';
import { dateKeyParis } from '@/lib/today/calendar';

export type SortiePhase = 'prep' | 'active' | 'bilan';

export type SortieSession = SortieProgress & {
  phase: SortiePhase;
  startedAt: string | null;
  finishedAt: string | null;
  originSource: 'agency' | 'field';
  origin: GeoCoord | null;
  /** Arrêts retirés avant le départ (clés). */
  removed: string[];
  rencontres: string[];
  absents: string[];
  /** Distance marche estimée au départ (Mapbox ou haversine). */
  plannedDistanceM: number;
  plannedDurationS: number | null;
};

export function emptySortieSession(signature = ''): SortieSession {
  return {
    signature,
    done: [],
    skipped: [],
    dictees: [],
    rencontres: [],
    absents: [],
    removed: [],
    phase: 'prep',
    startedAt: null,
    finishedAt: null,
    originSource: 'agency',
    origin: null,
    plannedDistanceM: 0,
    plannedDurationS: null,
  };
}

export function readSortieSession(key: string): SortieSession | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SortieSession>;
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      ...emptySortieSession(typeof parsed.signature === 'string' ? parsed.signature : ''),
      ...parsed,
      done: Array.isArray(parsed.done) ? parsed.done.map(String) : [],
      skipped: Array.isArray(parsed.skipped) ? parsed.skipped.map(String) : [],
      dictees: Array.isArray(parsed.dictees) ? parsed.dictees.map(String) : [],
      rencontres: Array.isArray(parsed.rencontres) ? parsed.rencontres.map(String) : [],
      absents: Array.isArray(parsed.absents) ? parsed.absents.map(String) : [],
      removed: Array.isArray(parsed.removed) ? parsed.removed.map(String) : [],
      phase:
        parsed.phase === 'active' || parsed.phase === 'bilan' || parsed.phase === 'prep'
          ? parsed.phase
          : 'prep',
      originSource: parsed.originSource === 'field' ? 'field' : 'agency',
      plannedDistanceM:
        typeof parsed.plannedDistanceM === 'number' ? parsed.plannedDistanceM : 0,
      plannedDurationS:
        typeof parsed.plannedDurationS === 'number' ? parsed.plannedDurationS : null,
    };
  } catch {
    return null;
  }
}

export function writeSortieSession(key: string, session: SortieSession): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(key, JSON.stringify(session));
  } catch {
    // quota
  }
}

export function activeStops(plan: SortiePlan, session: SortieSession): SortieStop[] {
  const removed = new Set(session.removed);
  return plan.ordered.filter((s) => !removed.has(s.key));
}

/** Boucle optimisée : départ → arrêts → départ. */
export function rebuildPlanFromStops(
  stops: readonly SortieStop[],
  origin: GeoCoord | null,
): SortiePlan | null {
  if (stops.length === 0) return null;
  const ordered = optimizeLoopOrder(stops, origin);
  if (ordered.length === 0) return null;
  return {
    ordered,
    distanceM: loopDistanceM(ordered, origin),
    signature: sortieSignature(ordered),
  };
}

export function currentStop(
  stops: readonly SortieStop[],
  session: SortieSession,
): SortieStop | null {
  const closed = new Set([...session.done, ...session.skipped, ...session.rencontres, ...session.absents]);
  return stops.find((s) => !closed.has(s.key)) ?? null;
}

export function completedCount(session: SortieSession): number {
  return new Set([
    ...session.done,
    ...session.skipped,
    ...session.rencontres,
    ...session.absents,
  ]).size;
}

export function isStopClosed(session: SortieSession, key: string): boolean {
  return (
    session.done.includes(key) ||
    session.skipped.includes(key) ||
    session.rencontres.includes(key) ||
    session.absents.includes(key)
  );
}

export const walkingPaceMinPerKm = 12;

export function estimateWalkDurationS(distanceM: number): number {
  // ~5 km/h marche urbaine
  return Math.max(60, Math.round((distanceM / 1000) * 12 * 60));
}

/** Estimation marche urbaine (~55 kcal/km, profil agent moyen). */
export function estimateWalkCalories(distanceM: number, durationS?: number | null): number {
  const fromDistance = (distanceM / 1000) * 55;
  if (durationS != null && durationS > 0) {
    return Math.round((fromDistance + (durationS / 60) * 4.5) / 2);
  }
  return Math.round(fromDistance);
}

export function todaySortieDay(): string {
  return dateKeyParis(new Date());
}

/** Propose un recalcul GPS seulement si l'agent est déjà loin de l'agence. */
export function shouldOfferFieldRecalc(
  agency: GeoCoord | null,
  gps: GeoCoord | null,
  thresholdM = 500,
): boolean {
  if (!agency || !gps) return false;
  return haversineM(agency, gps) > thresholdM;
}
