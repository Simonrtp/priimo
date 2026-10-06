/** Départements dont les ventes DVF sont chargées. Hors de ces codes : pas d’estimation. */
export const DEPARTEMENTS_COUVERTS = ['75', '74', '64'] as const;

export type DepartementCouvert = (typeof DEPARTEMENTS_COUVERTS)[number];

export function departementDuCodePostal(postalCode: string | null | undefined): string | null {
  const cp = (postalCode ?? '').trim();
  if (!/^\d{5}$/.test(cp)) return null;
  if (cp.startsWith('97') || cp.startsWith('98')) return cp.slice(0, 3);
  return cp.slice(0, 2);
}

export function secteurEstimeCouvert(postalCode: string | null | undefined): boolean {
  const dep = departementDuCodePostal(postalCode);
  return dep != null && (DEPARTEMENTS_COUVERTS as readonly string[]).includes(dep);
}

export const MESSAGE_SECTEUR_NON_COUVERT =
  'Les ventes comparables ne sont pas encore chargées sur ce secteur (données disponibles en 75, 74 et 64). Vous pouvez quand même saisir votre prix.';
