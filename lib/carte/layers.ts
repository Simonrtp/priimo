import type { MapPointKind } from '@/lib/carte/points';
import {
  DEFAULT_DPE_AGE_BUCKETS,
  parseDpeAgeBuckets,
  type DpeAgeBucket,
} from '@/lib/carte/dpe-age';

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

export const CADASTRE_LAYER_IDS = ['parcelles', 'dpe', 'ventes', 'copro'] as const;
export type CadastreLayerId = (typeof CADASTRE_LAYER_IDS)[number];

export const CADASTRE_LAYER_LABELS: Record<CadastreLayerId, string> = {
  parcelles: 'Parcelles',
  dpe: 'Diagnostics',
  ventes: 'Ventes',
  copro: 'Copropriétés',
};

export const CADASTRE_OVERLAY_IDS = ['dpe', 'ventes', 'copro'] as const;
export type CadastreOverlayId = (typeof CADASTRE_OVERLAY_IDS)[number];

export type MapLayerState = Record<MapPointKind, boolean> & {
  cadastre: boolean;
  cadastreDpe: boolean;
  cadastreVentes: boolean;
  cadastreCopro: boolean;
  cadastreDpeAges: DpeAgeBucket[];
  cadastreMenuOpen: boolean;
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
  cadastreDpeAges: [...DEFAULT_DPE_AGE_BUCKETS],
  cadastreMenuOpen: true,
};

export const MAP_LAYERS_STORAGE_KEY = 'priimo-carte-layers';
export const MAP_LAYERS_STORAGE_REV_KEY = 'priimo-carte-layers-rev';
/** Rev 3 : Cadastre est un dossier, plus un interrupteur maître. */
export const MAP_LAYERS_STORAGE_REV = 3;
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
    cadastreDpeAges: parseDpeAgeBuckets(row.cadastreDpeAges),
    cadastreMenuOpen: row.cadastreMenuOpen !== false,
  };
}

/** Rev 2 allumait DPE avec Cadastre. Rev 3 laisse chaque sous-couche indépendante. */
export function migrateStoredMapLayers(
  state: MapLayerState,
  rev: number,
): { state: MapLayerState; rev: number } {
  if (rev >= MAP_LAYERS_STORAGE_REV) return { state, rev };
  if (rev < 2 && state.cadastre && !state.cadastreDpe) {
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

export function withCadastreLayerToggled(prev: MapLayerState, id: CadastreLayerId): MapLayerState {
  if (id === 'parcelles') return { ...prev, cadastre: !prev.cadastre };
  if (id === 'dpe') return { ...prev, cadastreDpe: !prev.cadastreDpe };
  if (id === 'ventes') return { ...prev, cadastreVentes: !prev.cadastreVentes };
  return { ...prev, cadastreCopro: !prev.cadastreCopro };
}

export function withCadastreMenuToggled(prev: MapLayerState): MapLayerState {
  return { ...prev, cadastreMenuOpen: !prev.cadastreMenuOpen };
}

export function withDpeAgeToggled(prev: MapLayerState, bucket: DpeAgeBucket): MapLayerState {
  const has = prev.cadastreDpeAges.includes(bucket);
  const cadastreDpeAges = has
    ? prev.cadastreDpeAges.filter((item) => item !== bucket)
    : [...prev.cadastreDpeAges, bucket];
  return { ...prev, cadastreDpeAges };
}

export function readStoredMapLayers(): MapLayerState {
  if (typeof window === 'undefined') return { ...DEFAULT_MAP_LAYERS };
  try {
    const raw = window.localStorage.getItem(MAP_LAYERS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_MAP_LAYERS };
    const stored = JSON.parse(raw) as Record<string, unknown>;
    const parsed = parseMapLayers(stored);
    if (!Object.prototype.hasOwnProperty.call(stored, 'cadastreMenuOpen')) {
      parsed.cadastreMenuOpen = readCadastreMenuOpen();
    }
    const rev = Number(window.localStorage.getItem(MAP_LAYERS_STORAGE_REV_KEY) ?? '0');
    const migrated = migrateStoredMapLayers(parsed, Number.isFinite(rev) ? rev : 0);
    if (migrated.rev !== rev) {
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
