import { formatParcelleId, normalizeParcelleId } from '@/lib/carte/parcelle-id';
import type { PublicDiagnostic } from '@/lib/carte/dpe-public';

export { formatParcelleId, normalizeParcelleId } from '@/lib/carte/parcelle-id';
export {
  PUBLIC_DPE_MIN_AGE_MONTHS,
  DPE_PALETTE,
  dpeFillColor,
  filterPublicDiagnostics,
  isPublicDpeEligible,
  isPublicDpeTooRecent,
  parseDpeLetter,
  type PublicDiagnostic,
} from '@/lib/carte/dpe-public';

export const PARCELLE_MIN_ZOOM = 16;
export const CADASTRE_OVERLAY_MIN_ZOOM = 14;
export const PARCELLE_SLATE = '#3D5A80';
export const COPRO_PROCEDURE_FILL = '#1E3148';
export const COPRO_FILL = '#5B7C8A';
export const VENTE_FILL = '#3D5A80';

export type ParcelleVente = {
  date: string;
  prix: number | null;
  surface: number | null;
  prixM2: number | null;
  typeLocal: string | null;
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
  ventes: ParcelleVente[];
  diagnostics: PublicDiagnostic[];
  coproprietes: ParcelleCopro[];
  surCetteParcelle: ParcelleAgencyItem[];
};

export type ParcelleNoteMarker = {
  parcelleId: string;
  latitude: number | null;
  longitude: number | null;
};

export type CadastreImmeublePoint = {
  banId: string;
  parcelleId: string | null;
  longitude: number;
  latitude: number;
  adresse: string | null;
  etiquetteDpe: string | null;
  nbDpe: number;
  nbPassoires: number;
  nbTransactions: number;
  dernierPrix: number | null;
  prixM2: number | null;
  nbLots: number | null;
  procedureCopro: boolean;
};

export type ParcelleOverlay = {
  immeubles: CadastreImmeublePoint[];
  notes: ParcelleNoteMarker[];
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

export function emptyParcelleFiche(raw: string): ParcelleFiche {
  const parcelleId = normalizeParcelleId(raw) ?? (raw ?? '').trim().toUpperCase();
  return {
    parcelleId,
    reference: formatParcelleId(parcelleId),
    adresse: null,
    videPublic: true,
    ventes: [],
    diagnostics: [],
    coproprietes: [],
    surCetteParcelle: [],
  };
}
