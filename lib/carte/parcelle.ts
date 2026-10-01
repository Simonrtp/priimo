import { formatParcelleId, normalizeParcelleId } from '@/lib/carte/parcelle-id';
import type { PublicDiagnostic } from '@/lib/carte/dpe-public';
import type { CadastreSourceDates } from '@/lib/carte/cadastre-freshness';

export { formatParcelleId, normalizeParcelleId } from '@/lib/carte/parcelle-id';
export {
  PUBLIC_DPE_MIN_AGE_MONTHS,
  DPE_PALETTE,
  dpeFillColor,
  filterPublicDiagnostics,
  formatDpeEtage,
  isPublicDpeEligible,
  isPublicDpeTooRecent,
  parseDpeLetter,
  type PublicDiagnostic,
} from '@/lib/carte/dpe-public';
export type { CadastreSourceDates } from '@/lib/carte/cadastre-freshness';

export const PARCELLE_MIN_ZOOM = 16;
/** Zoom initial quand on veut voir et cliquer les parcelles (prise en main, cadastre). */
export const PARCELLE_FOCUS_ZOOM = 17;
/** DPE / ventes / copro : visibles dès la vue secteur, sans polygones PCI. */
export const CADASTRE_OVERLAY_MIN_ZOOM = 12;
/** Étiquette €/m² des ventes : invisible en dessous. */
export const VENTE_PRICE_LABEL_MIN_ZOOM = 17;
export const PARCELLE_SLATE = '#1A2A56';
export const COPRO_PROCEDURE_FILL = '#1A2A56';
export const COPRO_FILL = '#5B7C8A';
export const VENTE_FILL = '#1A2A56';
export const VENTE_PRICE_HALO = '#FFFFFF';

export type ParcelleVente = {
  date: string;
  prix: number | null;
  surface: number | null;
  prixM2: number | null;
  typeLocal: string | null;
  nombrePieces: number | null;
};

export type ParcelleCopro = {
  lots: number | null;
  periodeConstruction: string | null;
  procedureEnCours: boolean;
  numeroImmatriculation: string | null;
};

export type ParcelleAgencyItem = {
  id: string;
  kind: 'lead' | 'contact' | 'bien' | 'note';
  title: string;
  subtitle: string | null;
  href: string;
};

export type ParcelleFiche = {
  parcelleId: string;
  reference: string;
  adresse: string | null;
  videPublic: boolean;
  surfaceCadastreM2: number | null;
  nbAdresses: number;
  prixM2Median: number | null;
  ventes: ParcelleVente[];
  diagnostics: PublicDiagnostic[];
  coproprietes: ParcelleCopro[];
  surCetteParcelle: ParcelleAgencyItem[];
};

export type ParcellePickExtra = {
  surfaceM2?: number | null;
};

export type ParcelleNoteMarker = {
  parcelleId: string;
  latitude: number | null;
  longitude: number | null;
};

export type CadastreDpeGrain = 'adresse' | 'immeuble';

export type CadastreImmeublePoint = {
  banId: string;
  parcelleId: string | null;
  longitude: number;
  latitude: number;
  adresse: string | null;
  etiquetteDpe: string | null;
  /** adresse = diagnostic < 6 mois ; immeuble = agrégat au-delà. */
  dpeGrain: CadastreDpeGrain | null;
  dateDpe: string | null;
  surfaceDpe: number | null;
  etageDpe: number | null;
  nbDpe: number;
  nbPassoires: number;
  nbTransactions: number;
  dernierPrix: number | null;
  derniereTransactionLe: string | null;
  prixM2: number | null;
  nbLots: number | null;
  procedureCopro: boolean;
};

export type ParcelleOverlay = {
  immeubles: CadastreImmeublePoint[];
  notes: ParcelleNoteMarker[];
  sources: CadastreSourceDates;
};

type Ring = readonly (readonly number[])[];

function firstRing(geometry: unknown): Ring | null {
  if (!geometry || typeof geometry !== 'object') return null;
  const g = geometry as { type?: string; coordinates?: unknown };
  if (g.type === 'Polygon') {
    const coords = g.coordinates as Ring[] | undefined;
    return coords?.[0] ?? null;
  }
  if (g.type === 'MultiPolygon') {
    const coords = g.coordinates as Ring[][] | undefined;
    return coords?.[0]?.[0] ?? null;
  }
  return null;
}

/** Centroïde visuel d’un polygone de tuile — la géométrie ne quitte pas le client. */
export function centroidLngLat(geometry: unknown): { longitude: number; latitude: number } | null {
  const ring = firstRing(geometry);
  if (!ring || ring.length === 0) return null;
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (const pt of ring) {
    if (typeof pt[0] !== 'number' || typeof pt[1] !== 'number') continue;
    sx += pt[0];
    sy += pt[1];
    n += 1;
  }
  if (n === 0) return null;
  return { longitude: sx / n, latitude: sy / n };
}

/** Contenance cadastrale en m², d’après l’anneau PCI (approx. locale). */
export function surfaceCadastreM2(geometry: unknown): number | null {
  const ring = firstRing(geometry);
  if (!ring || ring.length < 4) return null;
  const lat0 = ((ring[0]![1] ?? 0) * Math.PI) / 180;
  const kx = 111_320 * Math.cos(lat0);
  const ky = 110_540;
  let s = 0;
  for (let i = 0; i < ring.length - 1; i += 1) {
    const x1 = (ring[i]![0] ?? 0) * kx;
    const y1 = (ring[i]![1] ?? 0) * ky;
    const x2 = (ring[i + 1]![0] ?? 0) * kx;
    const y2 = (ring[i + 1]![1] ?? 0) * ky;
    s += x1 * y2 - x2 * y1;
  }
  const a = Math.abs(s) / 2;
  if (a < 2) return null;
  return Math.round(a);
}

export function contenanceDepuisProps(
  props: Record<string, unknown> | null | undefined,
): number | null {
  const raw = props?.contenance ?? props?.area ?? props?.superficie;
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(String(raw).replace(',', '.')) : NaN;
  return Number.isFinite(n) && n > 1 ? Math.round(n) : null;
}

export function emptyParcelleFiche(raw: string): ParcelleFiche {
  const parcelleId = normalizeParcelleId(raw) ?? (raw ?? '').trim().toUpperCase();
  return {
    parcelleId,
    reference: formatParcelleId(parcelleId),
    adresse: null,
    videPublic: true,
    surfaceCadastreM2: null,
    nbAdresses: 0,
    prixM2Median: null,
    ventes: [],
    diagnostics: [],
    coproprietes: [],
    surCetteParcelle: [],
  };
}
