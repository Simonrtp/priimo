import type { ReactNode } from 'react';

const variants = {
  default: 'bg-white/[0.06] text-white/60',
  success: 'bg-emerald-500/15 text-emerald-400',
  warning: 'bg-amber-500/15 text-amber-400',
  danger: 'bg-red-500/15 text-red-400',
  info: 'bg-indigo-500/15 text-indigo-300',
  muted: 'bg-white/[0.04] text-white/40',
} as const;

export function Badge({
  children,
  variant = 'default',
}: {
  children: ReactNode;
  variant?: keyof typeof variants;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium leading-tight ${variants[variant]}`}
    >
      {children}
    </span>
  );
}

/** Badge de score lead : vert > 75, orange 50–75, rouge < 50. */
export function ScoreBadge({ score }: { score: number }) {
  const variant = score > 75 ? 'bg-emerald-500/15 text-emerald-400' : score >= 50 ? 'bg-amber-500/15 text-amber-400' : 'bg-red-500/15 text-red-400';
  return (
    <span
      className={`inline-flex min-w-[2.25rem] items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${variant}`}
    >
      {score}
    </span>
  );
}
