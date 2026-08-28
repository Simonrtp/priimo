import { notifySuccess } from '@/lib/notify';
import type { LeadStage } from '@/types/lead';

export type PipelineVictoryKind = 'premiere_prise' | 'rendez_vous' | 'mandat';

export function pipelineVictoryKind(
  from: Pick<LeadStage, 'id' | 'cle' | 'type'> | null | undefined,
  to: Pick<LeadStage, 'id' | 'cle' | 'type'>,
): PipelineVictoryKind | null {
  if (!from || from.id === to.id) return null;
  if (to.cle === 'rendez_vous') return 'rendez_vous';
  if (to.cle === 'mandat' || to.type === 'gagne') return 'mandat';
  return null;
}

/** Toast vert Sonner — victoires pipeline (première prise, RDV, mandat). */
export function celebratePipelineVictory(kind: PipelineVictoryKind): void {
  if (kind === 'premiere_prise') {
    // Prise en main : même animation, ton sobre. On s'adresse à un
    // professionnel, pas à un utilisateur d'application grand public.
    notifySuccess('Adresse prise. Elle est à vous.', {
      id: 'pipeline-victory-premiere-prise',
      duration: 3200,
    });
    return;
  }
  if (kind === 'rendez_vous') {
    notifySuccess('Bravo pour le rendez-vous !', {
      id: 'pipeline-victory-rdv',
      duration: 3600,
    });
    return;
  }
  notifySuccess('Bravo pour le mandat — félicitations !', {
    id: 'pipeline-victory-mandat',
    duration: 5200,
  });
}
