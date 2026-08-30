'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Carte englobante de l'espace de travail (effet HubSpot) : fond pastel,
 * coins arrondis et ombre clay. Toutes les cartes internes s'empilent dedans.
 *
 * Sur Estimation : décor Haussmann collé en bas de la card, derrière le scroll.
 */
export default function WorkspacePanel({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const showHaussmann = pathname.startsWith('/dashboard/estimation');

  return (
    <div className="priimo-pastel-wash relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[32px] border border-black/[0.06] shadow-clay">
      {showHaussmann ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-[120px] overflow-hidden rounded-b-[32px] md:h-[148px]"
          style={{
            maskImage:
              'linear-gradient(to top, black 0%, rgba(0,0,0,0.85) 40%, transparent 100%)',
            WebkitMaskImage:
              'linear-gradient(to top, black 0%, rgba(0,0,0,0.85) 40%, transparent 100%)',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- décor local */}
          <img
            src="/immeuble-haussmann.png"
            alt=""
            className="h-full w-full object-cover object-[78%_28%] opacity-[0.5]"
            decoding="async"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(to top, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.45) 50%, rgba(255,255,255,0.92) 100%)',
            }}
          />
        </div>
      ) : null}

      <div className="relative z-[1] min-h-0 flex-1 overflow-x-hidden overflow-y-auto rounded-[32px]">
        <div className="relative min-h-full rounded-[32px] p-6 lg:p-8">{children}</div>
      </div>
    </div>
  );
}
