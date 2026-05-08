'use client';

import type { Filters, SignalType, LeadStatus } from '@/types/lead';

interface FiltersBarProps {
  filters: Filters;
  onFiltersChange: (f: Filters) => void;
}

const signalPills: { value: 'all' | SignalType; label: string }[] = [
  { value: 'all',            label: 'Tous'             },
  { value: 'liquidation_pro', label: 'Événement de vie' },
  { value: 'dpe_recent',     label: 'DPE récent'       },
  { value: 'detention_longue', label: 'Détention'      },
  { value: 'plus_value',     label: 'Plus-value'       },
];

const statusPills: { value: 'all' | LeadStatus; label: string }[] = [
  { value: 'all',           label: 'Tous'          },
  { value: 'nouveau',       label: 'Nouveau'       },
  { value: 'contacté',      label: 'Contacté'      },
  { value: 'intéressé',     label: 'Intéressé'     },
  { value: 'pas_intéressé', label: 'Pas intéressé' },
];

function Pill({
  label, active, onClick, activeClass,
}: {
  label: string; active: boolean; onClick: () => void; activeClass: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full font-medium transition-colors duration-150 ${
        active ? activeClass : 'bg-black/[0.05] text-mute hover:bg-black/[0.09] hover:text-ink'
      }`}
      style={{ fontSize: 11.5, padding: '4px 12px', letterSpacing: '0.01em' }}
    >
      {label}
    </button>
  );
}

export default function FiltersBar({ filters, onFiltersChange }: FiltersBarProps) {
  const reset = () => onFiltersChange({ minScore: 0, signalType: 'all', status: 'all' });
  const isDirty = filters.minScore > 0 || filters.signalType !== 'all' || filters.status !== 'all';

  return (
    <div className="bg-white rounded-2xl shadow-soft border border-black/8 px-5 py-4 mb-4">
      {/* Row 1: Score + Signal */}
      <div className="flex items-center gap-5 mb-3">
        {/* Score slider */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <span className="uppercase text-mute tracking-widest" style={{ fontSize: 9, letterSpacing: '0.15em' }}>
            Score min
          </span>
          <input
            type="range" min={0} max={100} step={5}
            value={filters.minScore}
            onChange={(e) => onFiltersChange({ ...filters, minScore: +e.target.value })}
            className="w-20 accent-accent"
          />
          <span className="font-bold tabular text-accent-dark w-5 text-right" style={{ fontSize: 12 }}>
            {filters.minScore}
          </span>
        </div>

        {/* Divider */}
        <div className="w-px bg-black/10" style={{ height: 16 }} />

        {/* Signal pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {signalPills.map((p) => (
            <Pill
              key={p.value}
              label={p.label}
              active={filters.signalType === p.value}
              onClick={() => onFiltersChange({ ...filters, signalType: p.value })}
              activeClass={
                p.value === 'all'
                  ? 'bg-ink text-canvas'
                  : 'bg-accent/15 text-accent-dark'
              }
            />
          ))}
        </div>
      </div>

      {/* Row 2: Status + Reset */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="uppercase text-mute tracking-widest mr-1" style={{ fontSize: 9, letterSpacing: '0.15em' }}>
            Statut
          </span>
          {statusPills.map((p) => (
            <Pill
              key={p.value}
              label={p.label}
              active={filters.status === p.value}
              onClick={() => onFiltersChange({ ...filters, status: p.value })}
              activeClass={
                p.value === 'all'      ? 'bg-ink text-canvas'
                : p.value === 'nouveau'       ? 'bg-blue/15 text-blue-dark'
                : p.value === 'contacté'      ? 'bg-accent/15 text-accent-dark'
                : p.value === 'intéressé'     ? 'bg-emerald-500/15 text-emerald-700'
                : 'bg-black/[0.1] text-mute'
              }
            />
          ))}
        </div>
        {isDirty && (
          <button
            onClick={reset}
            className="text-mute hover:text-ink transition-colors uppercase tracking-widest"
            style={{ fontSize: 9, letterSpacing: '0.15em' }}
          >
            Réinitialiser
          </button>
        )}
      </div>
    </div>
  );
}
