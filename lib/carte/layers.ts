import type { MapPointKind } from '@/lib/carte/points';

export const MAP_LAYER_ORDER: readonly MapPointKind[] = [
  'lead',
  'contact',
  'bien',
  'note',
];

export const MAP_LAYER_LABELS: Record<MapPointKind, string> = {
  lead: 'Prospects',
  contact: 'Contacts',
  bien: 'Biens',
  note: 'Notes terrain',
};

export const PARCELLES_LAYER_ID = 'parcelles';
export const PARCELLES_LAYER_LABEL = 'Parcelles';

export type MapLayerState = Record<MapPointKind, boolean> & {
  parcelles: boolean;
};

export const DEFAULT_MAP_LAYERS: MapLayerState = {
  lead: true,
  contact: true,
  bien: false,
  note: true,
  parcelles: false,
};

export const MAP_LAYERS_STORAGE_KEY = 'priimo-carte-layers';
export const MAP_LAYERS_PANEL_STORAGE_KEY = 'priimo-carte-layers-panel';

export function parseMapLayers(raw: unknown): MapLayerState {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_MAP_LAYERS };
  const row = raw as Record<string, unknown>;
  return {
    lead: row.lead !== false,
    contact: row.contact !== false,
    bien: row.bien === true,
    note: row.note !== false,
    parcelles: row.parcelles === true,
  };
}

export function readStoredMapLayers(): MapLayerState {
  if (typeof window === 'undefined') return { ...DEFAULT_MAP_LAYERS };
  try {
    const raw = window.localStorage.getItem(MAP_LAYERS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_MAP_LAYERS };
    return parseMapLayers(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_MAP_LAYERS };
  }
}

export function persistMapLayers(state: MapLayerState): void {
  try {
    window.localStorage.setItem(MAP_LAYERS_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // quota / mode privé
  }
}

export function readLayersPanelOpen(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(MAP_LAYERS_PANEL_STORAGE_KEY) !== 'collapsed';
  } catch {
    return true;
  }
}

export function persistLayersPanelOpen(open: boolean): void {
  try {
    window.localStorage.setItem(MAP_LAYERS_PANEL_STORAGE_KEY, open ? 'open' : 'collapsed');
  } catch {
    // quota / mode privé
  }
}

export function activeKindSet(layers: MapLayerState): Set<MapPointKind> {
  return new Set(MAP_LAYER_ORDER.filter((kind) => layers[kind]));
}
