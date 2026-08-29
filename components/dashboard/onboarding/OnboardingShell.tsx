'use client';

import type { CSSProperties, ReactNode } from 'react';
import OnboardingRevealText from './OnboardingRevealText';

export const ONB_ACCENT = '#E8743C';
export const ONB_CREAM = '#FAF9F7';

/**
 * Cadre commun de la prise en main v2.
 * Progress 3 px orange marque, titres serif, actions #E8743C.
 */
export default function OnboardingShell({
  rang,
  total,
  titre,
  titreSuffix,
  phrase,
  children,
  action,
  compact,
}: {
  rang: number;
  total: number;
  titre: string;
  /** Emoji / ornement animé après le titre (ex. 🎂). */
  titreSuffix?: ReactNode;
  phrase?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  /** Moins d’espace sous le titre (écrans denses : avatar, carte). */
  compact?: boolean;
}) {
  const progress = Math.min(1, Math.max(0, rang / total));

  return (
    <section
      className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden"
      aria-label={`Prise en main — étape ${rang} sur ${total}`}
      style={{ '--onb-accent': ONB_ACCENT } as CSSProperties}
    >
      <div className="shrink-0 px-5 pt-[max(8px,env(safe-area-inset-top))] md:px-8 md:pt-2">
        <div
          className="h-[3px] w-full overflow-hidden rounded-full bg-black/[0.06]"
          role="progressbar"
          aria-valuenow={rang}
          aria-valuemin={1}
          aria-valuemax={total}
        >
          <div
            className="h-full rounded-full transition-[width] duration-[480ms] ease-out motion-reduce:transition-none"
            style={{ width: `${progress * 100}%`, backgroundColor: ONB_ACCENT }}
          />
        </div>
      </div>

      <div
        className={`flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-5 pb-[max(16px,env(safe-area-inset-bottom))] md:px-8 ${
          compact ? 'pt-6' : 'pt-10'
        }`}
      >
        <h1 className="onb-serif text-balance text-[28px] leading-[1.25] text-[#1A1A1A] md:text-[34px]">
          <OnboardingRevealText text={titre} staggerMs={52} />
          {titreSuffix ? (
            <span className="onb-emoji-bob ml-1.5 inline-block align-middle text-[1.05em]" aria-hidden>
              {titreSuffix}
            </span>
          ) : null}
        </h1>

        {phrase ? (
          <div className="onb-fade-up mt-3 max-w-[36rem] text-pretty text-[15px] leading-relaxed text-[#6B6B6B] [animation-delay:280ms]">
            {phrase}
          </div>
        ) : null}

        {children ? (
          <div
            className={`onb-fade-up min-h-0 flex-1 [animation-delay:420ms] ${compact ? 'mt-5' : 'mt-8'}`}
          >
            {children}
          </div>
        ) : null}

        {action ? (
          <div className="onb-fade-up mt-8 shrink-0 [animation-delay:560ms]">{action}</div>
        ) : null}
      </div>
    </section>
  );
}

export function OnboardingPrimaryButton({
  children,
  onClick,
  disabled,
  type = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="mx-auto flex w-full max-w-[280px] items-center justify-center rounded-2xl px-6 py-3.5 text-[15px] font-semibold text-white transition enabled:hover:brightness-[0.97] disabled:opacity-40"
      style={{ backgroundColor: ONB_ACCENT }}
    >
      {children}
    </button>
  );
}

export function OnboardingGhostLink({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mx-auto mt-4 block text-center text-[13.5px] text-[#8A8A8A] transition hover:text-[#1A1A1A]"
    >
      {children}
    </button>
  );
}
