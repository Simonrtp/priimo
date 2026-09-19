'use client';

import type { ReactNode } from 'react';

/**
 * Surlignage « à confirmer » : la voix propose, l’agent valide.
 * Les chiffres portent un anneau plus visible — la dictée se trompe surtout là.
 */
export default function ChampPropose({
  pending,
  chiffre = false,
  onConfirm,
  children,
}: {
  pending: boolean;
  chiffre?: boolean;
  onConfirm: () => void;
  children: ReactNode;
}) {
  if (!pending) return <>{children}</>;

  return (
    <div
      className={
        chiffre
          ? 'rounded-xl bg-[#E8743C]/[0.10] p-2 ring-2 ring-[#E8743C]'
          : 'rounded-xl bg-[#E8743C]/[0.08] p-1.5 ring-1 ring-[#E8743C]/55'
      }
    >
      {children}
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <p className="text-pretty text-[12px] font-semibold text-[#E8743C]">
          {chiffre ? 'Chiffre à confirmer' : 'À confirmer'}
        </p>
        <button
          type="button"
          onClick={onConfirm}
          className="inline-flex min-h-11 shrink-0 items-center rounded-clay px-3 text-[13px] font-semibold text-[#E8743C] hover:bg-[#E8743C]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Valider
        </button>
      </div>
    </div>
  );
}
