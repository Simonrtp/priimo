import { mediane } from '@/lib/estimation/moteur';

export type NiveauConfiance = 'élevée' | 'moyenne' | 'faible';

export type ConfianceComparables = {
  nombre: number;
  /** Écart interquartile relatif à la médiane. Null s’il y a moins de 4 prix. */
  dispersion: number | null;
  niveau: NiveauConfiance;
  /** 0–100, issu du nombre et de la dispersion. Jamais une fourchette inventée. */
  indice: number;
  message: string;
};

/**
 * Indice de confiance des comparables retenus.
 * Peu de ventes, ou des prix très dispersés : le message le dit.
 */
export function confianceComparables(prix: readonly number[]): ConfianceComparables | null {
  const vals = prix.filter((n) => Number.isFinite(n) && n > 0);
  if (vals.length === 0) return null;
  const n = vals.length;
  const med = mediane(vals);
  const tries = [...vals].sort((a, b) => a - b);
  const q1 = tries[Math.floor(tries.length * 0.25)]!;
  const q3 = tries[Math.floor(tries.length * 0.75)]!;
  const dispersion = med != null && med > 0 && n >= 4 ? (q3 - q1) / med : null;
  let indice = Math.min(70, n * 8);
  if (dispersion != null) indice += dispersion < 0.15 ? 30 : dispersion < 0.3 ? 15 : 0;
  indice = Math.max(0, Math.min(100, indice));
  const peuNombreux = n < 5;
  const peuComparables = dispersion != null && dispersion >= 0.35;
  const niveau: NiveauConfiance =
    !peuNombreux && !peuComparables && n >= 8 && (dispersion ?? 1) < 0.2
      ? 'élevée'
      : !peuNombreux && !peuComparables
        ? 'moyenne'
        : 'faible';
  const parts = [`${n} vente${n > 1 ? 's' : ''} comparable${n > 1 ? 's' : ''}`];
  if (dispersion != null) {
    parts.push(`écart des prix ${Math.round(dispersion * 100)} %`);
  }
  let message = `Indice de confiance ${indice}/100 (${niveau}) — ${parts.join(', ')}.`;
  if (peuNombreux) {
    message += ' Peu de ventes : la fourchette est fragile.';
  }
  if (peuComparables) {
    message += ' Les ventes sont peu comparables entre elles.';
  }
  return { nombre: n, dispersion, niveau, indice, message };
}
