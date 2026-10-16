import { compteursSemaine } from '@/lib/activite/derive';
import type { JournalActivite } from '@/lib/activite/derive';
import type { Intervalle } from '@/lib/activite/semaines';

export type AgentPodium = {
  id: string;
  prenom: string;
  nom: string;
  avatarUrl: string | null;
  score: number;
};

/** Les trois plus actifs sur l'intervalle. À score égal, l'ordre alphabétique départage. */
export function podiumSemaine(
  journal: JournalActivite,
  membres: readonly { id: string; prenom: string; nom: string; avatarUrl: string | null }[],
  semaine: Intervalle,
): AgentPodium[] {
  const classes = membres
    .map((m) => {
      const c = compteursSemaine({ journal, profileId: m.id, semaine });
      const score = Object.values(c).reduce((s, n) => s + n, 0);
      return { id: m.id, prenom: m.prenom, nom: m.nom, avatarUrl: m.avatarUrl, score };
    })
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score || a.prenom.localeCompare(b.prenom, 'fr') || a.id.localeCompare(b.id));
  return classes.slice(0, 3);
}
