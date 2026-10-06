import type { BuildingMarker } from '@/lib/carte/buildings';
import type { SortieStop } from '@/lib/today/sortie';

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
