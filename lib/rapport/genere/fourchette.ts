import { arrondirMillier } from '@/lib/rapport/genere/format';

export function assurerFourchette(
  value: number,
  low: number | null,
  high: number | null,
): { low: number; high: number; ajoutee: boolean } {
  if (low != null && high != null && low < high) {
    return { low, high, ajoutee: false };
  }
  return {
    low: arrondirMillier(value * 0.92),
    high: arrondirMillier(value * 1.08),
    ajoutee: true,
  };
}

export function surfacePourPrixM2(input: {
  surfaceM2: number | null;
  surfaceCarrez: number | null;
}): { m2: number; libelle: 'Carrez' | 'habitable' } | null {
  if (input.surfaceCarrez != null && input.surfaceCarrez > 0) {
    return { m2: input.surfaceCarrez, libelle: 'Carrez' };
  }
  if (input.surfaceM2 != null && input.surfaceM2 > 0) {
    return { m2: input.surfaceM2, libelle: 'habitable' };
  }
  return null;
}

/** Source unique : prix final ÷ surface retenue. Jamais une valeur stockée. */
export function prixAuM2(
  prix: number | null | undefined,
  surfaceM2: number | null | undefined,
): number | null {
  if (prix == null || !Number.isFinite(prix) || prix <= 0) return null;
  if (surfaceM2 == null || !Number.isFinite(surfaceM2) || surfaceM2 <= 0) return null;
  return Math.round(prix / surfaceM2);
}

export function prixAuM2DepuisDossier(input: {
  priceValue: number | null;
  surfaceM2: number | null;
  surfaceCarrez: number | null;
}): { prixM2: number; libelle: 'Carrez' | 'habitable' } | null {
  const surf = surfacePourPrixM2(input);
  if (!surf) return null;
  const prixM2 = prixAuM2(input.priceValue, surf.m2);
  if (prixM2 == null) return null;
  return { prixM2, libelle: surf.libelle };
}
