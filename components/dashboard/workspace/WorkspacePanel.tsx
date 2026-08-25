import type { ReactNode } from 'react';
import WorkspaceBackdrop from '@/components/dashboard/workspace/WorkspaceBackdrop';

/**
 * Carte englobante de l'espace de travail (effet HubSpot) : fond blanc,
 * coins arrondis et ombre clay. Toutes les cartes internes s'empilent dedans.
 */
export default function WorkspacePanel({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-full overflow-hidden rounded-tl-[22px] rounded-tr-clay-lg rounded-b-clay-lg border border-black/[0.06] bg-surface shadow-clay md:rounded-tl-[28px]">
      <WorkspaceBackdrop />
      <div className="relative z-[1] p-6 lg:p-8">{children}</div>
    </div>
  );
}
