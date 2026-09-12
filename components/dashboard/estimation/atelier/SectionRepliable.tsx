'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

export default function SectionRepliable({
  titre,
  ouvertDefaut = false,
  children,
}: {
  titre: string;
  ouvertDefaut?: boolean;
  children: ReactNode;
}) {
  const [ouvert, setOuvert] = useState(ouvertDefaut);
  return (
    <section className="rounded-clay border border-black/[0.06] bg-surface shadow-clay-sm">
      <button
        type="button"
        aria-expanded={ouvert}
        onClick={() => setOuvert((v) => !v)}
        className="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="text-pretty text-[14.5px] font-semibold text-text-strong">{titre}</span>
        <ChevronDown
          size={16}
          aria-hidden
          className={`shrink-0 text-text-muted transition-transform ${ouvert ? 'rotate-180' : ''}`}
        />
      </button>
      {ouvert ? <div className="border-t border-black/[0.05] px-4 py-4">{children}</div> : null}
    </section>
  );
}
