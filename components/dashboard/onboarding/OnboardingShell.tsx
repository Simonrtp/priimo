'use client';

import type { ReactNode } from 'react';

/**
 * Le cadre commun aux cinq étapes.
 *
 * Il occupe la zone de contenu de l'Accueil : pas de modale, pas d'overlay,
 * pas de page à part. La sidebar reste visible et cliquable — on ne séquestre
 * pas l'utilisateur, et le bouton « Passer » est là à chaque étape pour qui
 * veut arriver à l'application en un clic.
 */
export default function OnboardingShell({
  rang,
  total,
  titre,
  phrase,
  onPasser,
  children,
  action,
}: {
  rang: number;
  total: number;
  titre: string;
  /** Une ou deux phrases. Jamais plus. */
  phrase: ReactNode;
  onPasser: () => void;
  children: ReactNode;
  /** Ce que l'agent doit faire pour avancer. */
  action?: ReactNode;
}) {
  return (
    <section
      className="flex w-full min-w-0 flex-col"
      aria-label={`Prise en main — étape ${rang} sur ${total}`}
    >
      <header className="flex items-start justify-between gap-4 pb-4">
        <div className="min-w-0">
          <p className="text-[12.5px] font-medium tabular-nums text-text-subtle">
            {rang} sur {total}
          </p>
          <h1
            className="mt-1 text-balance font-semibold tracking-tight text-ink"
            style={{ fontSize: 22, letterSpacing: '-0.02em' }}
          >
            {titre}
          </h1>
        </div>
        <button
          type="button"
          onClick={onPasser}
          className="shrink-0 rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-text-subtle transition-colors hover:bg-black/[0.04] hover:text-ink"
        >
          Passer
        </button>
      </header>

      <p className="max-w-2xl text-pretty text-[15px] leading-relaxed text-text">{phrase}</p>

      <div className="mt-5 min-w-0">{children}</div>

      {action ? <div className="mt-5">{action}</div> : null}

      <div className="mt-6 flex gap-1.5" aria-hidden>
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className="h-1 flex-1 rounded-full transition-colors"
            style={{ backgroundColor: i < rang ? 'var(--primary-500)' : 'rgba(0,0,0,0.08)' }}
          />
        ))}
      </div>
    </section>
  );
}
