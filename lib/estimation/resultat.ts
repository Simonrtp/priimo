/**
 * Formulation de l'écran de résultat.
 *
 * Deux principes tiennent tout ce fichier : on écrit ce dont on dispose, pas
 * ce qui manque ; et quand le secteur est trop hétérogène, on le dit au lieu
 * d'afficher une fourchette molle — c'est un meilleur argument commercial, et
 * c'est une raison de rencontrer le vendeur.
 */

export const DISPERSION_MESSAGE =
  'Les biens comparables de ce secteur sont trop hétérogènes pour une fourchette resserrée. Une visite est nécessaire.';

export type ResultatSummary = {
  comparables: number;
  radiusM: number;
  trimestre: string | null;
  immeubleVentes: number;
};

/** « 13 ventes comparables dans un rayon de 200 m, réactualisées au 2e trimestre 2026 ». */
export function phraseComparables(summary: ResultatSummary): string {
  const { comparables, radiusM, trimestre } = summary;
  if (comparables === 0) {
    return 'Estimation établie à partir des prix constatés dans la commune.';
  }
  const ventes = `${comparables} vente${comparables > 1 ? 's' : ''} comparable${comparables > 1 ? 's' : ''}`;
  const base = `${ventes} dans un rayon de ${radiusM} m`;
  return trimestre ? `${base}, réactualisées au ${trimestre}` : base;
}

/** Précision facultative, ajoutée seulement quand elle apporte quelque chose. */
export function phraseImmeuble(summary: ResultatSummary): string | null {
  if (summary.immeubleVentes <= 0) return null;
  const n = summary.immeubleVentes;
  return `dont ${n} dans l’immeuble`;
}

export type NiveauFiabilite = 'elevee' | 'correcte' | 'limitee';

export function niveauFiabilite(score: number): NiveauFiabilite {
  if (score >= 70) return 'elevee';
  if (score >= 40) return 'correcte';
  return 'limitee';
}

export const FIABILITE_LABEL: Record<NiveauFiabilite, string> = {
  elevee: 'Fiabilité élevée',
  correcte: 'Fiabilité correcte',
  limitee: 'Fiabilité limitée',
};

export function formatEuro(n: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n);
}
