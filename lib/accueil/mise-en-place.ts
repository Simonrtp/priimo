/** Ce qu’il reste à brancher sur l’Accueil, avant que Ma semaine tourne. */

export const TACHES_MISE_EN_PLACE = ['secteur'] as const;
export type TacheMiseEnPlace = (typeof TACHES_MISE_EN_PLACE)[number];

export function tachesMiseEnPlace(opts: { aUnSecteur: boolean }): TacheMiseEnPlace[] {
  return opts.aUnSecteur ? [] : ['secteur'];
}
