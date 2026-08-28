import type { ReactNode } from 'react';

/**
 * Carte englobante de l'espace de travail (effet HubSpot) : fond blanc,
 * coins arrondis et ombre clay. Toutes les cartes internes s'empilent dedans.
 */
export default function WorkspacePanel({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[32px] border border-black/[0.06] bg-surface shadow-clay">
      <div className="relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto rounded-[32px]">
        <div className="relative z-[1] min-h-full rounded-[32px] p-6 lg:p-8">{children}</div>
      </div>
    </div>
  );
}
