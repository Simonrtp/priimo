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

export const CADASTRE_LAYER_IDS = ['dpe', 'ventes', 'copro'] as const;
export type CadastreLayerId = (typeof CADASTRE_LAYER_IDS)[number];

export const CADASTRE_LAYER_LABELS: Record<CadastreLayerId, string> = {
  dpe: 'DPE',
  ventes: 'Ventes',
  copro: 'Copropriétés',
};

export type MapLayerState = Record<MapPointKind, boolean> & {
  cadastre: boolean;
  cadastreDpe: boolean;
  cadastreVentes: boolean;
  cadastreCopro: boolean;
};

export const DEFAULT_MAP_LAYERS: MapLayerState = {
  lead: true,
  contact: true,
  bien: true,
  note: true,
  cadastre: false,
  cadastreDpe: false,
  cadastreVentes: false,
  cadastreCopro: false,
};

export const MAP_LAYERS_STORAGE_KEY = 'priimo-carte-layers';
export const MAP_LAYERS_PANEL_STORAGE_KEY = 'priimo-carte-layers-panel';
export const CADASTRE_MENU_STORAGE_KEY = 'priimo-carte-cadastre-menu';

export function parseMapLayers(raw: unknown): MapLayerState {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_MAP_LAYERS };
  const row = raw as Record<string, unknown>;
  const cadastre = row.cadastre === true || row.parcelles === true;
  return {
    lead: row.lead !== false,
    contact: row.contact !== false,
    bien: row.bien !== false,
    note: row.note !== false,
    cadastre,
    cadastreDpe: row.cadastreDpe === true,
    cadastreVentes: row.cadastreVentes === true,
    cadastreCopro: row.cadastreCopro === true,
  };
}

export function anyCadastreLayer(layers: MapLayerState): boolean {
  return layers.cadastre || layers.cadastreDpe || layers.cadastreVentes || layers.cadastreCopro;
}

export function anyCadastreOverlay(layers: MapLayerState): boolean {
  return layers.cadastreDpe || layers.cadastreVentes || layers.cadastreCopro;
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

export function readCadastreMenuOpen(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(CADASTRE_MENU_STORAGE_KEY) === 'open';
  } catch {
    return false;
  }
}

export function persistCadastreMenuOpen(open: boolean): void {
  try {
    window.localStorage.setItem(CADASTRE_MENU_STORAGE_KEY, open ? 'open' : 'collapsed');
  } catch {
    // quota / mode privé
  }
}

export function activeKindSet(layers: MapLayerState): Set<MapPointKind> {
  return new Set(MAP_LAYER_ORDER.filter((kind) => layers[kind]));
}
