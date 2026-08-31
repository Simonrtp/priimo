'use client';

import type { CSSProperties, ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
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
  /** Contenu carte : pas de scroll vertical, le flex-1 remplit la hauteur. */
  fill,
}: {
  rang: number;
  total: number;
  titre: string;
  /** Ornement optionnel après le titre. */
  titreSuffix?: ReactNode;
  phrase?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  /** Moins d’espace sous le titre (écrans denses : avatar, carte). */
  compact?: boolean;
  fill?: boolean;
}) {
  const progress = Math.min(1, Math.max(0, rang / total));

  return (
    <section
      className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden"
      aria-label={`Prise en main — étape ${rang} sur ${total}`}
      style={{ '--onb-accent': ONB_ACCENT } as CSSProperties}
    >
      <div className="shrink-0 px-5 pt-[max(8px,env(safe-area-inset-top))] md:px-10 md:pt-3 lg:px-14">
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
        className={`flex min-h-0 flex-1 flex-col px-5 pb-[max(16px,env(safe-area-inset-bottom))] md:px-10 lg:px-14 ${
          fill ? 'overflow-hidden' : 'overflow-y-auto overscroll-contain'
        } ${compact ? 'pt-6 md:pt-8' : 'pt-10 md:pt-12'}`}
      >
        <h1 className="onb-serif max-w-[28ch] shrink-0 text-balance text-[28px] leading-[1.25] text-[#1A1A1A] md:max-w-[22ch] md:text-[40px] lg:text-[44px]">
          <OnboardingRevealText text={titre} staggerMs={52} />
          {titreSuffix ? (
            <span className="ml-1.5 inline-block align-middle text-[1.05em]" aria-hidden>
              {titreSuffix}
            </span>
          ) : null}
        </h1>

        {phrase ? (
          <div className="onb-fade-up mt-3 max-w-[36rem] shrink-0 text-pretty text-[15px] leading-relaxed text-[#6B6B6B] md:mt-4 md:max-w-2xl md:text-[17px] [animation-delay:280ms]">
            {phrase}
          </div>
        ) : null}

        {children ? (
          <div
            className={`onb-fade-up flex min-h-0 w-full flex-1 flex-col [animation-delay:420ms] ${compact ? 'mt-5 md:mt-7' : 'mt-8 md:mt-10'}`}
          >
            {children}
          </div>
        ) : null}

        {action ? (
          <div className="onb-fade-up mt-6 shrink-0 md:mt-8 [animation-delay:560ms]">{action}</div>
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
      className="onb-cta group mx-auto flex w-full max-w-[280px] items-center justify-center gap-2.5 rounded-2xl bg-[#E8743C] px-6 py-3.5 text-[15px] font-semibold text-white shadow-[0_4px_14px_-6px_rgba(232,116,60,0.45)] transition-[transform,background-color,box-shadow] duration-150 ease-out enabled:hover:-translate-y-0.5 enabled:hover:bg-[#C25E2C] enabled:hover:shadow-[0_12px_28px_-8px_rgba(194,94,44,0.55)] enabled:active:translate-y-0 enabled:active:scale-[0.97] enabled:active:bg-[#A34E24] enabled:active:shadow-none disabled:opacity-40 motion-reduce:transition-none motion-reduce:enabled:hover:translate-y-0 motion-reduce:enabled:active:scale-100 md:max-w-[340px] md:gap-3 md:py-4 md:text-[16px]"
    >
      <span>{children}</span>
      <ArrowRight
        size={18}
        strokeWidth={2.4}
        aria-hidden
        className="onb-cta-arrow shrink-0 transition-transform duration-150 ease-out group-hover:translate-x-1 group-active:translate-x-1.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
      />
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
