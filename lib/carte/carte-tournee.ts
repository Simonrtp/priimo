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
  type SortiePlan,
  type SortieStop,
} from '@/lib/today/sortie';

export type CarteStopSource = 'mine' | 'pool' | 'manual' | 'batch';

export type CarteStopCandidate = SortieStop & { source: CarteStopSource };

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

export function searchResultToManualStop(input: {
  label: string;
  latitude: number;
  longitude: number;
  banId?: string | null;
  postalCode?: string | null;
}): SortieStop {
  const key = input.banId
    ? `ban:${input.banId}`
    : `search:${input.latitude.toFixed(5)},${input.longitude.toFixed(5)}`;
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

export function suggestedSortiePlan(
  leads: readonly Lead[],
  profileId: string,
  origin: GeoCoord | null,
): SortiePlan | null {
  return buildSortie(leads, profileId, origin);
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
