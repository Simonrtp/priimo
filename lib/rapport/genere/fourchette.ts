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
