import { compteursSemaine } from '@/lib/activite/derive';
import type { JournalActivite } from '@/lib/activite/derive';
import type { Intervalle } from '@/lib/activite/semaines';
import type { Activite } from '@/lib/activite/types';

export type StatsPodium = Record<Activite, number>;

export type AgentPodium = {
  id: string;
  prenom: string;
  nom: string;
  avatarUrl: string | null;
  score: number;
  stats: StatsPodium;
};

/**
 * Tous les collaborateurs, du plus actif au moins actif.
 * Quelqu'un sans passage reste là, à 0 : une marche vide n'est pas une place.
 * À score égal, l'ordre alphabétique départage. L'affichage ne garde que les trois premiers.
 */
export function podiumSemaine(
  journal: JournalActivite,
  membres: readonly { id: string; prenom: string; nom: string; avatarUrl: string | null }[],
  semaine: Intervalle,
): AgentPodium[] {
  return membres
    .map((m) => {
      const stats = compteursSemaine({ journal, profileId: m.id, semaine });
      const score = Object.values(stats).reduce((s, n) => s + n, 0);
      return { id: m.id, prenom: m.prenom, nom: m.nom, avatarUrl: m.avatarUrl, score, stats };
    })
    .sort((a, b) => b.score - a.score || a.prenom.localeCompare(b.prenom, 'fr') || a.id.localeCompare(b.id));
}
