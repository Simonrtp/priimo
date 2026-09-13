/**
 * Prix et sièges : configuration, jamais des constantes métier.
 * Changer les env suffit. Chaque agence reçoit une copie à l’activation.
 */

function entierPositif(raw: string | undefined, repli: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return repli;
  return Math.floor(n);
}

function euros(raw: string | undefined, repli: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return repli;
  return Math.round(n * 100) / 100;
}

export type ConfigAbonnement = {
  siegesInclus: number;
  prixBase: number;
  prixSiege: number;
  essaiJours: number;
};

/** Replis uniquement si la config n’est pas encore posée. */
export function lireConfigAbonnement(): ConfigAbonnement {
  return {
    siegesInclus: entierPositif(process.env.BILLING_SIEGES_INCLUS, 3),
    prixBase: euros(process.env.BILLING_PRIX_BASE, 149),
    prixSiege: euros(process.env.BILLING_PRIX_SIEGE, 29),
    essaiJours: entierPositif(process.env.BILLING_ESSAI_JOURS, 14),
  };
}

export function eurosVersCents(eurosVal: number): number {
  return Math.round(eurosVal * 100);
}

export function formaterEuros(montant: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: montant % 1 === 0 ? 0 : 2,
  }).format(montant);
}
