import type { ReactNode } from 'react';

/**
 * En-tête d'écran. Deux options maximum : une action principale, au plus une
 * secondaire. Le reste passe par un menu, jamais par un troisième bouton.
 */
export default function PageHeader({
  title,
  subtitle,
  primaryAction,
  secondaryAction,
}: {
  title: string;
  subtitle?: string;
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 md:mb-8 lg:mb-10">
      <div className="min-w-0">
        <h1
          className="text-balance text-[22px] font-semibold tracking-tight text-text-strong sm:text-[26px] lg:text-[30px]"
          style={{ letterSpacing: '-0.025em', lineHeight: 1.15 }}
        >
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-2 text-pretty text-[13.5px] text-text-muted sm:text-[15px]">{subtitle}</p>
        ) : null}
      </div>

      {primaryAction || secondaryAction ? (
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          {secondaryAction}
          {primaryAction}
        </div>
      ) : null}
    </header>
  );
}
