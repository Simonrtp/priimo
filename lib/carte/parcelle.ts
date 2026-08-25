/** Identifiant cadastral PCI (14 caractères, ex. 75104000AD0035). */
const IDU_RE = /^[0-9A-Z]{8,20}$/;

export const PARCELLE_MIN_ZOOM = 16;
export const PARCELLE_SLATE = '#3D5A80';

export function normalizeIdu(raw: string | null | undefined): string | null {
  const value = (raw ?? '').trim().toUpperCase();
  if (!IDU_RE.test(value)) return null;
  return value;
}

export function formatIdu(idu: string): string {
  const v = idu.trim().toUpperCase();
  if (v.length === 14) {
    return `${v.slice(0, 5)} ${v.slice(5, 8)} ${v.slice(8, 10)} ${v.slice(10)}`;
  }
  return v;
}

/** DPE daté il y a moins de 12 mois : hors couche gratuite. */
export function isPublicDpeTooRecent(dateIso: string | null | undefined, now: Date = new Date()): boolean {
  if (!dateIso) return false;
  const t = Date.parse(dateIso);
  if (!Number.isFinite(t)) return false;
  const cutoff = new Date(now.getTime());
  cutoff.setFullYear(cutoff.getFullYear() - 1);
  return t > cutoff.getTime();
}

export function isDpeDiagnostic(type: string | null | undefined): boolean {
  if (!type) return true;
  return /dpe/i.test(type);
}

export type PublicDiagnostic = {
  date: string | null;
  etiquette: string | null;
  type: string | null;
};

export function filterPublicDiagnostics<T extends PublicDiagnostic>(
  rows: readonly T[],
  now: Date = new Date(),
): T[] {
  return rows.filter((row) => {
    if (!isDpeDiagnostic(row.type) && row.type) return true;
    return !isPublicDpeTooRecent(row.date, now);
  });
}

export type ParcelleVente = {
  date: string;
  prix: number | null;
  surface: number | null;
  prixM2: number | null;
};

export type ParcelleCopro = {
  lots: number | null;
  periodeConstruction: string | null;
  procedureEnCours: string | null;
};

export type ParcelleAgencyItem = {
  id: string;
  kind: 'lead' | 'contact' | 'bien' | 'note';
  title: string;
  subtitle: string | null;
  href: string;
};

export type ParcelleFiche = {
  idu: string;
  reference: string;
  adresse: string | null;
  videPublic: boolean;
  ventes: ParcelleVente[];
  diagnostics: PublicDiagnostic[];
  copropriete: ParcelleCopro | null;
  surCetteParcelle: ParcelleAgencyItem[];
};

export type ParcelleNoteMarker = {
  idu: string;
  latitude: number | null;
  longitude: number | null;
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
