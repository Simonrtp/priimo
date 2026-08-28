'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { RevealableStep } from '@/lib/estimation/use-revealed-steps';

/**
 * La trace du calcul, dépliable, sur l'écran de résultat.
 *
 * Les étapes défilent vite pendant le calcul ; les conserver ici règle le
 * problème autrement qu'en ralentissant : la vitesse n'est plus un obstacle,
 * puisque la trace reste consultable.
 */
export default function Methode({ steps }: { steps: readonly RevealableStep[] }) {
  const [open, setOpen] = useState(false);
  if (steps.length === 0) return null;

  return (
    <section className="rounded-2xl border border-black/[0.07] bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
      >
        <span className="text-[14px] font-semibold text-neutral-900">
          Méthode — {steps.length} étape{steps.length > 1 ? 's' : ''} de calcul
        </span>
        <ChevronDown
          size={18}
          className={`shrink-0 text-neutral-500 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>
      {open ? (
        <ol className="border-t border-black/[0.06] px-4 py-3">
          {steps.map((step, i) => (
            <li
              key={`${step.id}:${i}`}
              className="flex gap-3 border-b border-black/[0.04] py-2.5 text-[13px] leading-snug text-neutral-700 last:border-0"
            >
              <span className="w-5 shrink-0 tabular-nums text-neutral-400">{i + 1}</span>
              <span>{step.label}</span>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
