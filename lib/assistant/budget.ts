/**
 * Plafond mensuel de tokens par agence. Variable serveur, jamais côté client.
 * Atteint, on le dit en français — pas une erreur technique.
 */

export const DEFAULT_MONTHLY_TOKEN_CAP = 2_000_000;

export function monthlyTokenCap(): number {
  const raw = process.env.ASSISTANT_TOKENS_MENSUELS_PAR_AGENCE?.trim();
  if (!raw) return DEFAULT_MONTHLY_TOKEN_CAP;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_MONTHLY_TOKEN_CAP;
  return Math.floor(n);
}

/** Début du mois courant, en UTC — même repère que created_at. */
export function debutDuMois(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export function moisCourant(now = new Date()): string {
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${now.getUTCFullYear()}-${m}`;
}

export type BudgetEtat = {
  consommes: number;
  plafond: number;
  restants: number;
  depasse: boolean;
};

export function etatBudget(consommes: number, plafond = monthlyTokenCap()): BudgetEtat {
  const restants = Math.max(0, plafond - consommes);
  return { consommes, plafond, restants, depasse: consommes >= plafond };
}

export const MESSAGE_PLAFOND_ATTEINT =
  "L'assistant a atteint sa limite d'utilisation pour ce mois-ci. La recherche dans la base reste disponible. Contactez Priimo pour relever la limite.";
