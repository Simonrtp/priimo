'use client';

import { Check, Loader2 } from 'lucide-react';
import { useRevealedSteps, type RevealableStep } from '@/lib/estimation/use-revealed-steps';

/**
 * Écran de calcul.
 *
 * Chaque étape reste affichée au moins 400 ms : le travail n'est pas ralenti,
 * seul l'affichage l'est, le temps qu'on puisse le lire. La liste complète
 * reste ensuite consultable dans la section « Méthode » du résultat.
 */
export default function EtapesCalcul({
  steps,
  encours,
  titre = 'Calcul en cours',
}: {
  steps: readonly RevealableStep[];
  encours: boolean;
  titre?: string;
}) {
  const revealed = useRevealedSteps(steps);

  return (
    <section className="flex flex-col gap-4" aria-live="polite" aria-busy={encours}>
      <div className="flex items-center gap-2">
        {encours ? (
          <Loader2
            className="size-5 animate-spin"
            style={{ color: 'var(--est-accent)' }}
            aria-hidden
          />
        ) : (
          <Check className="size-5" style={{ color: 'var(--est-accent)' }} aria-hidden />
        )}
        <h2 className="text-[17px] font-semibold text-neutral-900">{titre}</h2>
      </div>

      <ol className="flex flex-col gap-2">
        {revealed.map((step, i) => (
          <li
            key={`${step.id}:${i}`}
            className="flex items-start gap-3 rounded-xl border border-black/[0.07] bg-white px-4 py-3 text-[13.5px] leading-snug text-neutral-800"
            style={{ animation: 'fadeIn 0.28s ease-out' }}
          >
            <span
              className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-white"
              style={{ backgroundColor: 'var(--est-accent)' }}
            >
              <Check size={12} strokeWidth={3} aria-hidden />
            </span>
            <span>{step.label}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
