/** Pense-bête de l’accueil — un texte perso, pas une note de dossier. */

export const PENSE_BETE_MAX = 2000;
export const PENSE_BETE_PREF_KEY = 'penseBete';

export function lirePenseBete(preferences: unknown): string {
  if (!preferences || typeof preferences !== 'object') return '';
  const v = (preferences as Record<string, unknown>)[PENSE_BETE_PREF_KEY];
  return typeof v === 'string' ? v.slice(0, PENSE_BETE_MAX) : '';
}

export function ecrirePenseBete(
  preferences: Record<string, unknown>,
  texte: string,
): Record<string, unknown> {
  return {
    ...preferences,
    [PENSE_BETE_PREF_KEY]: texte.slice(0, PENSE_BETE_MAX),
  };
}
