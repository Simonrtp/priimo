import type { TodayCard } from '@/lib/today/cards';

/** Un rendez-vous en cours, ou qui commence dans moins de deux heures. */
export const IMMINENCE_RDV_PROCHE = 95;

/**
 * La tâche à mettre sous les yeux de l'agent à cette heure-ci.
 *
 * Un rendez-vous en cours ou imminent passe devant tout le reste : à 14 h, une
 * visite qui démarre compte plus qu'un dossier à fort enjeu mais sans horaire.
 * Sinon on reprend le tri habituel, enjeu × imminence.
 */
export function tacheDuMoment(cards: readonly TodayCard[]): TodayCard | null {
  const rendezVous = cards
    .filter((c) => c.type === 'rendez_vous' && c.imminence >= IMMINENCE_RDV_PROCHE)
    .sort((a, b) => b.imminence - a.imminence || b.score - a.score);
  if (rendezVous[0]) return rendezVous[0];

  return [...cards].sort((a, b) => b.score - a.score)[0] ?? null;
}
