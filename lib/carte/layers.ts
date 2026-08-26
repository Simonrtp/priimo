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
export const MAP_LAYERS_STORAGE_REV_KEY = 'priimo-carte-layers-rev';
export const MAP_LAYERS_STORAGE_REV = 2;
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
    cadastreDpe: row.cadastreDpe === true || (cadastre && !('cadastreDpe' in row)),
    cadastreVentes: row.cadastreVentes === true,
    cadastreCopro: row.cadastreCopro === true,
  };
}

/** Rev 2 : Cadastre déjà coché allume les points DPE (ils étaient éteints en silence). */
export function migrateStoredMapLayers(
  state: MapLayerState,
  rev: number,
): { state: MapLayerState; rev: number } {
  if (rev >= MAP_LAYERS_STORAGE_REV) return { state, rev };
  if (state.cadastre && !state.cadastreDpe) {
    return { state: { ...state, cadastreDpe: true }, rev: MAP_LAYERS_STORAGE_REV };
  }
  return { state, rev: MAP_LAYERS_STORAGE_REV };
}

export function anyCadastreLayer(layers: MapLayerState): boolean {
  return layers.cadastre || layers.cadastreDpe || layers.cadastreVentes || layers.cadastreCopro;
}

export function anyCadastreOverlay(layers: MapLayerState): boolean {
  return layers.cadastreDpe || layers.cadastreVentes || layers.cadastreCopro;
}

/** Activer Cadastre allume aussi les points DPE (petits points A–G). */
export function withCadastreToggled(prev: MapLayerState): MapLayerState {
  const cadastre = !prev.cadastre;
  return {
    ...prev,
    cadastre,
    cadastreDpe: cadastre ? true : prev.cadastreDpe,
  };
}

export function readStoredMapLayers(): MapLayerState {
  if (typeof window === 'undefined') return { ...DEFAULT_MAP_LAYERS };
  try {
    const raw = window.localStorage.getItem(MAP_LAYERS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_MAP_LAYERS };
    const parsed = parseMapLayers(JSON.parse(raw));
    const rev = Number(window.localStorage.getItem(MAP_LAYERS_STORAGE_REV_KEY) ?? '0');
    const migrated = migrateStoredMapLayers(parsed, Number.isFinite(rev) ? rev : 0);
    if (migrated.rev !== rev || migrated.state.cadastreDpe !== parsed.cadastreDpe) {
      window.localStorage.setItem(MAP_LAYERS_STORAGE_REV_KEY, String(migrated.rev));
      persistMapLayers(migrated.state);
    }
    return migrated.state;
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
  if (typeof window === 'undefined') return true;
  try {
    const raw = window.localStorage.getItem(CADASTRE_MENU_STORAGE_KEY);
    if (raw == null) return true;
    return raw === 'open';
  } catch {
    return true;
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
