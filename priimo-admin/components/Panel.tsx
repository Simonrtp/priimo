import type { ReactNode } from 'react';

export function Panel({
  title,
  subtitle,
  action,
  children,
  bodyClassName = '',
  className = '',
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  bodyClassName?: string;
  className?: string;
}) {
  return (
    <section
      className={`overflow-hidden rounded-2xl border border-white/[0.06] bg-surface ${className}`}
    >
      {title ? (
        <header className="flex items-center justify-between gap-4 border-b border-white/[0.06] px-5 py-3.5">
          <div>
            <h2 className="text-sm font-semibold text-white">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-xs text-white/40">{subtitle}</p> : null}
          </div>
          {action}
        </header>
      ) : null}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

/** En-tête de page standard. */
export function PageHeader({ title, subtitle }: { title: string; subtitle?: ReactNode }) {
  return (
    <header className="space-y-1">
      <h1 className="text-2xl font-semibold tracking-tight text-white">{title}</h1>
      {subtitle ? <p className="text-sm text-white/45">{subtitle}</p> : null}
    </header>
  );
}
