import { arrondirMillier } from '@/lib/rapport/genere/format';

/** Ancienne fourchette ±8 % écrite comme si elle venait des ventes. */
export function estFourchetteInventee(value: number, low: number, high: number): boolean {
  const bas = value * 0.92;
  const haut = value * 1.08;
  const exacte = Math.abs(low - bas) < 1 && Math.abs(high - haut) < 1;
  const arrondie = low === arrondirMillier(bas) && high === arrondirMillier(haut);
  return exacte || arrondie;
}

/** Bornes déjà calculées sur les comparables. Jamais un pourcentage posé à la place. */
export function fourchetteReelle(
  value: number | null,
  low: number | null,
  high: number | null,
): { low: number; high: number } | null {
  if (value == null || low == null || high == null) return null;
  if (!(low < value && high > value && low < high)) return null;
  if (estFourchetteInventee(value, low, high)) return null;
  return { low, high };
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
