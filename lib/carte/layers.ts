import type { MapPointKind } from '@/lib/carte/points';
import {
  DEFAULT_DPE_AGE_BUCKETS,
  dpeAgeBucketsInSpan,
  parseDpeAgeBuckets,
  type DpeAgeBucket,
} from '@/lib/carte/dpe-age';

export const MAP_LAYER_ORDER: readonly MapPointKind[] = [
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
  dpe: 'DPE',
  ventes: 'Ventes (DVF)',
  copro: 'Copropriétés',
};

/** Couches proposées dans le panneau. Copropriétés n’y figure plus. */
export const CADASTRE_OVERLAY_IDS = ['dpe', 'ventes'] as const;
export type CadastreOverlayMenuId = (typeof CADASTRE_OVERLAY_IDS)[number];

/** Pastille cadastre. Copropriétés reste reconnu par la carte, hors du panneau. */
export type CadastreOverlayId = CadastreOverlayMenuId | 'copro';

export const ANNONCES_VENDEURS = ['particulier', 'professionnel', 'tous'] as const;
export type AnnoncesVendeur = (typeof ANNONCES_VENDEURS)[number];

export const ANNONCES_STATUTS = ['actives', 'nouvelles', 'baisse', 'retirees'] as const;
export type AnnoncesStatut = (typeof ANNONCES_STATUTS)[number];

export type MapLayerState = Record<MapPointKind, boolean> & {
  cadastre: boolean;
  cadastreDpe: boolean;
  cadastreVentes: boolean;
  cadastreCopro: boolean;
  cadastreDpeAges: DpeAgeBucket[];
  cadastreMenuOpen: boolean;
  /** Couche Annonces affichée. */
  annonces: boolean;
  annoncesMenuOpen: boolean;
  annoncesVendeur: AnnoncesVendeur;
  annoncesStatut: AnnoncesStatut;
  annoncesMonSecteur: boolean;
  /** Classes DPE retenues (« FG »), vide = toutes. */
  annoncesDpe: string;
  /** Pièces : '' = toutes, '5' = 5 et plus. */
  annoncesPieces: string;
  annoncesPrixMax: string;
};

export const DEFAULT_MAP_LAYERS: MapLayerState = {
  lead: false,
  contact: true,
  bien: true,
  note: true,
  /** Plan PCI : off par défaut ; s’affiche aussi dès qu’un overlay (DPE/ventes/copro) est coché. */
  cadastre: false,
  cadastreDpe: false,
  cadastreVentes: false,
  cadastreCopro: false,
  cadastreDpeAges: [...DEFAULT_DPE_AGE_BUCKETS],
  cadastreMenuOpen: false,
  annonces: false,
  annoncesMenuOpen: false,
  annoncesVendeur: 'particulier',
  annoncesStatut: 'actives',
  annoncesMonSecteur: false,
  annoncesDpe: '',
  annoncesPieces: '',
  annoncesPrixMax: '',
};

export const MAP_LAYERS_STORAGE_KEY = 'priimo-carte-layers';
export const MAP_LAYERS_STORAGE_REV_KEY = 'priimo-carte-layers-rev';
/**
 * Rev 6 : plan parcellaire off par défaut (sauf si overlay cadastre actif).
 * Rev 7 : « Mon secteur » des annonces éteint une fois — allumé par défaut, il
 * vidait la carte des négociateurs au petit secteur.
 * Rev 8 : la couche Copropriétés n’est plus proposée.
 * Rev 9 : annonces masquées, menu Cadastre replié.
 */
export const MAP_LAYERS_STORAGE_REV = 9;
export const MAP_LAYERS_PANEL_STORAGE_KEY = 'priimo-carte-layers-panel';
export const CADASTRE_MENU_STORAGE_KEY = 'priimo-carte-cadastre-menu';

export function parseMapLayers(raw: unknown): MapLayerState {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_MAP_LAYERS };
  const row = raw as Record<string, unknown>;
  const cadastre = row.cadastre === true || row.parcelles === true;
  return {
    lead: false,
    contact: row.contact !== false,
    bien: row.bien !== false,
    note: row.note !== false,
    cadastre,
    cadastreDpe: row.cadastreDpe === true,
    cadastreVentes: row.cadastreVentes === true,
    cadastreCopro: false,
    cadastreDpeAges: parseDpeAgeBuckets(row.cadastreDpeAges),
    cadastreMenuOpen: row.cadastreMenuOpen === true,
    ...parseAnnonces(row),
    annoncesPieces: typeof row.annoncesPieces === 'string' ? row.annoncesPieces : '',
    annoncesPrixMax: typeof row.annoncesPrixMax === 'string' ? row.annoncesPrixMax : '',
  };
}

type ChampsAnnonces = Pick<
  MapLayerState,
  | 'annonces'
  | 'annoncesMenuOpen'
  | 'annoncesVendeur'
  | 'annoncesStatut'
  | 'annoncesMonSecteur'
  | 'annoncesDpe'
  | 'annoncesPieces'
  | 'annoncesPrixMax'
>;

function choix<T extends string>(valeur: unknown, permis: readonly T[]): T | null {
  return typeof valeur === 'string' && (permis as readonly string[]).includes(valeur) ? (valeur as T) : null;
}

/**
 * Réglages enregistrés avant l'interrupteur général : « Actives / Retirées /
 * En baisse » allumaient la couche, « Particuliers » choisissait le vendeur.
 */
function parseAnnonces(row: Record<string, unknown>): ChampsAnnonces {
  const ancienActives = row.annoncesActives === true;
  const ancienRetirees = row.annoncesRetirees === true;
  const ancienBaisse = row.annoncesBaisse === true;
  const ancienStatut: AnnoncesStatut = ancienBaisse
    ? 'baisse'
    : ancienRetirees && !ancienActives
      ? 'retirees'
      : 'actives';
  const dpe = typeof row.annoncesDpe === 'string' ? row.annoncesDpe.toUpperCase().replace(/[^A-G]/g, '') : '';
  return {
    annonces:
      typeof row.annonces === 'boolean' ? row.annonces : ancienActives || ancienRetirees || ancienBaisse,
    annoncesMenuOpen: row.annoncesMenuOpen === true,
    annoncesVendeur:
      choix(row.annoncesVendeur, ANNONCES_VENDEURS) ??
      (row.annoncesParticuliers === false ? 'tous' : 'particulier'),
    annoncesStatut: choix(row.annoncesStatut, ANNONCES_STATUTS) ?? ancienStatut,
    annoncesMonSecteur: row.annoncesMonSecteur === true,
    annoncesDpe: dpe,
    annoncesPieces: typeof row.annoncesPieces === 'string' ? row.annoncesPieces : '',
    annoncesPrixMax: typeof row.annoncesPrixMax === 'string' ? row.annoncesPrixMax : '',
  };
}

export function coucheAnnoncesActive(layers: MapLayerState): boolean {
  return layers.annonces;
}

export function withAnnoncesMenuToggled(prev: MapLayerState): MapLayerState {
  return { ...prev, annoncesMenuOpen: !prev.annoncesMenuOpen };
}

/** Rev 6 : plan off par défaut ; pastilles restent éteintes si on vient d’avant. */
export function migrateStoredMapLayers(
  state: MapLayerState,
  rev: number,
): { state: MapLayerState; rev: number } {
  if (rev >= MAP_LAYERS_STORAGE_REV) return { state, rev };
  let next = state;
  if (rev < 6) {
    next = {
      ...next,
      annoncesMonSecteur: false,
      cadastre: false,
      ...(rev < 5
        ? {
            cadastreDpe: false,
            cadastreVentes: false,
            cadastreCopro: false,
          }
        : {}),
    };
  } else if (rev === 6) {
    next = { ...next, annoncesMonSecteur: false };
  }
  if (rev < 8) next = { ...next, cadastreCopro: false };
  if (rev < 9) next = { ...next, annonces: false, annoncesMenuOpen: false, cadastreMenuOpen: false };
  return { state: next, rev: MAP_LAYERS_STORAGE_REV };
}

/** Au moins une couche cadastre cochée (plan ou overlay). */
export function anyCadastreLayer(layers: MapLayerState): boolean {
  return layers.cadastre || anyCadastreOverlay(layers);
}

export function anyCadastreOverlay(layers: MapLayerState): boolean {
  return layers.cadastreDpe || layers.cadastreVentes || layers.cadastreCopro;
}

/** Plan PCI visible : case Parcelles, ou un overlay qui en a besoin. */
export function showParcellesPlan(layers: MapLayerState): boolean {
  return layers.cadastre || anyCadastreOverlay(layers);
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

export function withDpeAgeSpan(prev: MapLayerState, from: number, to: number): MapLayerState {
  return { ...prev, cadastreDpeAges: dpeAgeBucketsInSpan(from, to) };
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
  if (typeof window === 'undefined') return false;
  try {
    const raw = window.localStorage.getItem(CADASTRE_MENU_STORAGE_KEY);
    if (raw == null) return false;
    return raw === 'open';
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
