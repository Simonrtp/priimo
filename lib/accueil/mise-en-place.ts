/** Ce qu’il reste à brancher sur l’Accueil, avant que Ma semaine tourne. */

export const TACHES_MISE_EN_PLACE = ['agenda', 'secteur'] as const;
export type TacheMiseEnPlace = (typeof TACHES_MISE_EN_PLACE)[number];

export function tachesMiseEnPlace(opts: {
  agendaConnecte: boolean;
  aUnSecteur: boolean;
}): TacheMiseEnPlace[] {
  const taches: TacheMiseEnPlace[] = [];
  if (!opts.agendaConnecte) taches.push('agenda');
  if (!opts.aUnSecteur) taches.push('secteur');
  return taches;
}
