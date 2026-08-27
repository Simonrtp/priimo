import type { BuildingMarker } from '@/lib/carte/buildings';
import type { GeoCoord } from '@/lib/carte/coords';
import type { Lead } from '@/types/lead';
import {
  formatDeliveryBatchLabel,
  getLatestDeliveredAt,
} from '@/lib/lead-delivery';
import {
  buildSortie,
  isLeadForSortie,
  leadToSortieStop,
  MAX_SORTIE_STOPS,
  type SortiePlan,
  type SortieStop,
} from '@/lib/today/sortie';
import { rebuildPlanFromStops } from '@/lib/today/sortie-session';

export type CarteStopSource = 'mine' | 'pool' | 'manual' | 'batch';

export type CarteStopCandidate = SortieStop & { source: CarteStopSource };

export type BatchScope = 'all' | 'mine';

export type LatestBatchCandidates = {
  deliveredAt: string | null;
  label: string;
  all: CarteStopCandidate[];
  mine: CarteStopCandidate[];
};

export function latestBatchCandidates(
  leads: readonly Lead[],
  profileId: string,
): LatestBatchCandidates {
  const deliveredAt = getLatestDeliveredAt([...leads]);
  if (!deliveredAt) {
    return { deliveredAt: null, label: '', all: [], mine: [] };
  }

  const all: CarteStopCandidate[] = [];
  const mine: CarteStopCandidate[] = [];
  for (const lead of leads) {
    if (lead.deliveredAt !== deliveredAt) continue;
    if (!isLeadForSortie(lead, profileId)) continue;
    const stop = leadToSortieStop(lead);
    if (!stop) continue;
    all.push({ ...stop, source: 'batch' });
    if (lead.assignedTo === profileId) {
      mine.push({ ...stop, source: 'mine' });
    }
  }
  all.sort((a, b) => b.score - a.score);
  mine.sort((a, b) => b.score - a.score);

  return {
    deliveredAt,
    label: formatDeliveryBatchLabel(deliveredAt),
    all,
    mine,
  };
}

/** Sélectionne les arrêts du lot (max 10, meilleurs scores). */
export function batchKeysForScope(
  batch: LatestBatchCandidates,
  scope: BatchScope,
): string[] {
  const source = scope === 'mine' ? batch.mine : batch.all;
  return source.slice(0, MAX_SORTIE_STOPS).map((s) => s.key);
}

export function applyBatchSelection(
  batch: LatestBatchCandidates,
  scope: BatchScope,
  manualKeys: readonly string[],
  previousSelected: ReadonlySet<string>,
): Set<string> {
  const batchKeySet = new Set([...batch.all, ...batch.mine].map((s) => s.key));
  const next = new Set<string>();
  for (const key of previousSelected) {
    if (!batchKeySet.has(key)) next.add(key);
  }
  for (const key of manualKeys) next.add(key);
  for (const key of batchKeysForScope(batch, scope)) next.add(key);
  return next;
}

export function searchResultToManualStop(input: {
  label: string;
  latitude: number;
  longitude: number;
  banId?: string | null;
  postalCode?: string | null;
}): SortieStop {
  const key = input.banId ? `ban:${input.banId}` : `search:${input.latitude.toFixed(5)},${input.longitude.toFixed(5)}`;
  return {
    key,
    leadId: key,
    address: input.label,
    latitude: input.latitude,
    longitude: input.longitude,
    score: 0,
    surfaceM2: null,
    etage: null,
    mainSignalLabel: null,
    notes: null,
    banId: input.banId ?? null,
    postalCode: input.postalCode ?? null,
  };
}

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
  batch: LatestBatchCandidates,
  scope: BatchScope = 'mine',
  manualKeys: readonly string[] = [],
): Set<string> {
  if (plan && plan.ordered.length > 0) {
    return new Set(plan.ordered.map((s) => s.key));
  }
  if (batch.all.length > 0) {
    return applyBatchSelection(batch, scope, manualKeys, new Set());
  }
  return new Set(manualKeys);
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
  batch: LatestBatchCandidates,
  manual: readonly SortieStop[],
): Map<string, SortieStop> {
  const map = new Map<string, SortieStop>();
  for (const s of [...batch.all, ...manual]) map.set(s.key, s);
  return map;
}
