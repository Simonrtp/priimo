import type { MapPointKind } from '@/lib/carte/points';
import {
  DEFAULT_DPE_AGE_BUCKETS,
  dpeAgeBucketsInSpan,
  parseDpeAgeBuckets,
  type DpeAgeBucket,
} from '@/lib/carte/dpe-age';

/**
 * Couches points proposées dans les filtres.
 * Contacts, notes et biens n’y figurent plus (plus affichés sur la carte).
 */
export const MAP_LAYER_ORDER: readonly MapPointKind[] = [];

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

/** Overlay proposé dans le panneau : DPE seul (ventes / copro retirés). */
export const CADASTRE_OVERLAY_IDS = ['dpe'] as const;
export type CadastreOverlayMenuId = (typeof CADASTRE_OVERLAY_IDS)[number];

/** Pastille cadastre. Ventes / copro restent reconnus hors panneau. */
export type CadastreOverlayId = CadastreOverlayMenuId | 'ventes' | 'copro';

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
  /** Plus proposés dans les filtres : toujours masqués sur la carte. */
  contact: false,
  bien: false,
  note: false,
  /** Plan PCI : toujours allumé ; plus d’interrupteur dans les filtres. */
  cadastre: true,
  cadastreDpe: false,
  /** Plus proposé : toujours masqué. */
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
 * Rev 10 : parcelles toujours actives ; Biens retiré des filtres.
 * Rev 11 : Contacts, Notes et Ventes (DVF) retirés ; carte Cadastre → DPE.
 */
export const MAP_LAYERS_STORAGE_REV = 11;
export const MAP_LAYERS_PANEL_STORAGE_KEY = 'priimo-carte-layers-panel';
export const CADASTRE_MENU_STORAGE_KEY = 'priimo-carte-cadastre-menu';

export function parseMapLayers(raw: unknown): MapLayerState {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_MAP_LAYERS };
  const row = raw as Record<string, unknown>;
  return {
    lead: false,
    contact: false,
    bien: false,
    note: false,
    cadastre: true,
    cadastreDpe: row.cadastreDpe === true,
    cadastreVentes: false,
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
  if (rev < 10) next = { ...next, cadastre: true, bien: false };
  if (rev < 11) {
    next = {
      ...next,
      contact: false,
      note: false,
      cadastreVentes: false,
      cadastreMenuOpen: false,
    };
  }
  return { state: next, rev: MAP_LAYERS_STORAGE_REV };
}

/** Au moins une couche cadastre cochée (plan ou overlay). */
export function anyCadastreLayer(layers: MapLayerState): boolean {
  return layers.cadastre || anyCadastreOverlay(layers);
}

export function anyCadastreOverlay(layers: MapLayerState): boolean {
  return layers.cadastreDpe || layers.cadastreVentes || layers.cadastreCopro;
}

/** Plan PCI : toujours visible. */
export function showParcellesPlan(_layers?: MapLayerState): boolean {
  return true;
}

export function withCadastreLayerToggled(prev: MapLayerState, id: CadastreLayerId): MapLayerState {
  // Parcelles : plus d’interrupteur — le plan reste allumé.
  if (id === 'parcelles') return { ...prev, cadastre: true };
  if (id === 'dpe') return { ...prev, cadastreDpe: !prev.cadastreDpe };
  // Ventes / copro : plus proposés — restent éteints.
  if (id === 'ventes') return { ...prev, cadastreVentes: false };
  return { ...prev, cadastreCopro: false };
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
