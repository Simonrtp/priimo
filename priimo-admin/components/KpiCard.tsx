import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

type Accent = 'indigo' | 'emerald' | 'amber' | 'sky';

const accents: Record<Accent, { circle: string; icon: string; glow: string }> = {
  indigo: {
    circle: 'bg-indigo-500/10 ring-indigo-500/20',
    icon: 'text-indigo-400',
    glow: 'hover:shadow-[0_0_24px_rgba(99,102,241,0.18)] hover:border-indigo-500/30',
  },
  emerald: {
    circle: 'bg-emerald-500/10 ring-emerald-500/20',
    icon: 'text-emerald-400',
    glow: 'hover:shadow-[0_0_24px_rgba(16,185,129,0.18)] hover:border-emerald-500/30',
  },
  amber: {
    circle: 'bg-amber-500/10 ring-amber-500/20',
    icon: 'text-amber-400',
    glow: 'hover:shadow-[0_0_24px_rgba(245,158,11,0.18)] hover:border-amber-500/30',
  },
  sky: {
    circle: 'bg-sky-500/10 ring-sky-500/20',
    icon: 'text-sky-400',
    glow: 'hover:shadow-[0_0_24px_rgba(56,189,248,0.18)] hover:border-sky-500/30',
  },
};

export function KpiCard({
  label,
  value,
  icon: Icon,
  accent = 'indigo',
  sub,
}: {
  label: string;
  value: ReactNode;
  icon?: LucideIcon;
  accent?: Accent;
  sub?: ReactNode;
}) {
  const a = accents[accent];

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5 backdrop-blur-sm transition-all duration-300 ${a.glow}`}
    >
      <div className="flex items-start justify-between">
        <p className="text-[11px] font-medium uppercase tracking-widest text-white/40">{label}</p>
        {Icon ? (
          <span
            className={`flex h-9 w-9 items-center justify-center rounded-full ring-1 ${a.circle}`}
          >
            <Icon className={`h-4 w-4 ${a.icon}`} />
          </span>
        ) : null}
      </div>
      <p className="mt-4 text-4xl font-bold tabular-nums text-gradient-indigo">{value}</p>
      {sub ? <div className="mt-1.5 text-xs text-white/45">{sub}</div> : null}
    </div>
  );
}
