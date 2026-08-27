import type { BuildingMarker } from '@/lib/carte/buildings';
import type { GeoCoord } from '@/lib/carte/coords';
import type { Lead } from '@/types/lead';
import {
  buildSortie,
  isLeadForSortie,
  leadToSortieStop,
  type SortiePlan,
  type SortieStop,
} from '@/lib/today/sortie';
import { rebuildPlanFromStops } from '@/lib/today/sortie-session';

export type CarteStopSource = 'mine' | 'pool' | 'manual';

export type CarteStopCandidate = SortieStop & { source: CarteStopSource };

export function categorizeLeads(
  leads: readonly Lead[],
  profileId: string,
): { mine: CarteStopCandidate[]; pool: CarteStopCandidate[] } {
  const mine: CarteStopCandidate[] = [];
  const pool: CarteStopCandidate[] = [];
  for (const lead of leads) {
    if (!isLeadForSortie(lead, profileId)) continue;
    const stop = leadToSortieStop(lead);
    if (!stop) continue;
    if (lead.assignedTo === profileId) {
      mine.push({ ...stop, source: 'mine' });
    } else {
      pool.push({ ...stop, source: 'pool' });
    }
  }
  mine.sort((a, b) => b.score - a.score);
  pool.sort((a, b) => b.score - a.score);
  return { mine, pool };
}

export function suggestedSortiePlan(
  leads: readonly Lead[],
  profileId: string,
  origin: GeoCoord | null,
): SortiePlan | null {
  return buildSortie(leads, profileId, origin);
}

export function defaultSelectedKeys(
  plan: SortiePlan | null,
  mine: readonly CarteStopCandidate[],
): Set<string> {
  if (plan && plan.ordered.length > 0) {
    return new Set(plan.ordered.map((s) => s.key));
  }
  return new Set(mine.slice(0, 10).map((s) => s.key));
}

export function buildingToManualStop(building: BuildingMarker): SortieStop | null {
  const lead = building.entities.find((e) => e.kind === 'lead');
  if (lead) {
    return {
      key: lead.recordId,
      leadId: lead.recordId,
      address: building.title,
      latitude: building.latitude,
      longitude: building.longitude,
      score: lead.score ?? 0,
      surfaceM2: null,
      etage: null,
      mainSignalLabel: lead.subtitle || null,
      notes: null,
      banId: building.banId,
      postalCode: building.postalCode,
    };
  }
  return {
    key: `ban:${building.banId}`,
    leadId: `ban:${building.banId}`,
    address: building.title,
    latitude: building.latitude,
    longitude: building.longitude,
    score: 0,
    surfaceM2: null,
    etage: null,
    mainSignalLabel: null,
    notes: null,
    banId: building.banId,
    postalCode: building.postalCode,
  };
}

export function buildPlanFromSelection(
  candidates: Map<string, SortieStop>,
  selectedKeys: ReadonlySet<string>,
  origin: GeoCoord | null,
): SortiePlan | null {
  const stops = [...selectedKeys]
    .map((key) => candidates.get(key))
    .filter((s): s is SortieStop => Boolean(s));
  return rebuildPlanFromStops(stops, origin);
}

export function mergeCandidates(
  mine: readonly CarteStopCandidate[],
  pool: readonly CarteStopCandidate[],
  manual: readonly SortieStop[],
): Map<string, SortieStop> {
  const map = new Map<string, SortieStop>();
  for (const s of [...mine, ...pool, ...manual]) map.set(s.key, s);
  return map;
}
