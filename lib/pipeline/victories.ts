import { notifySuccess } from '@/lib/notify';
import type { LeadStage } from '@/types/lead';

export type PipelineVictoryKind =
  | 'contacte'
  | 'rendez_vous'
  | 'estimation'
  | 'mandat'
  | 'vendu';

export function pipelineVictoryKind(
  from: Pick<LeadStage, 'id' | 'cle' | 'type'> | null | undefined,
  to: Pick<LeadStage, 'id' | 'cle' | 'type'>,
): PipelineVictoryKind | null {
  if (!from || from.id === to.id) return null;
  if (to.cle === 'contacte') return 'contacte';
  if (to.cle === 'rendez_vous') return 'rendez_vous';
  if (to.cle === 'estimation') return 'estimation';
  if (to.cle === 'mandat') return 'mandat';
  if (to.cle === 'vendu') return 'vendu';
  if (to.type === 'gagne') return 'mandat';
  return null;
}

/** Toast vert Sonner — victoires pipeline (contacté, RDV, estimation, mandat). */
export function celebratePipelineVictory(kind: PipelineVictoryKind): void {
  if (kind === 'contacte') {
    notifySuccess('Nouveau contact — ça compte pour ta semaine.', {
      id: 'pipeline-victory-contacte',
      duration: 3600,
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
  if (kind === 'estimation') {
    notifySuccess('Estimation — +1 pour ta semaine.', {
      id: 'pipeline-victory-estimation',
      duration: 3600,
    });
    return;
  }
  if (kind === 'vendu') {
    notifySuccess('Vendu — félicitations !', {
      id: 'pipeline-victory-vendu',
      duration: 5200,
    });
    return;
  }
  notifySuccess('Mandat signé — +1 pour ta semaine.', {
    id: 'pipeline-victory-mandat',
    duration: 5200,
  });
}
