'use client';

import type { Filters, LeadStatus, SignalType, TeamMember } from '@/types/lead';
import { STATUS_META, STATUS_ORDER, SIGNAL_META } from '@/lib/lead-meta';

interface FiltersBarProps {
  filters: Filters;
  onFiltersChange: (f: Filters) => void;
  teamMembers: TeamMember[];
  availableSignals: SignalType[];
  showAssignedFilter?: boolean;
}

function Pill({
  label,
  active,
  onClick,
  activeClass,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  activeClass: string;
}) {
  return (
    <button
      type="button"
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

const selectClass =
  'border border-black/8 rounded-xl px-3 py-2 text-ink bg-white focus:outline-none focus:border-accent/40 cursor-pointer text-[13px] min-w-[140px]';

export default function FiltersBar({
  filters,
  onFiltersChange,
  teamMembers,
  availableSignals,
  showAssignedFilter = true,
}: FiltersBarProps) {
  const reset = () =>
    onFiltersChange({
      minScore: 0,
      signalType: 'all',
      status: 'all',
      assignedTo: 'all',
    });

  const isDirty =
    filters.minScore > 0 ||
    filters.signalType !== 'all' ||
    filters.status !== 'all' ||
    (showAssignedFilter && filters.assignedTo !== 'all');

  return (
    <div className="bg-white rounded-2xl shadow-soft border border-black/8 px-5 py-4 mb-4">
      <div className="flex items-center gap-5 mb-3 flex-wrap">
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <span className="uppercase text-mute tracking-widest" style={{ fontSize: 9, letterSpacing: '0.15em' }}>
            Score min
          </span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={filters.minScore}
            onChange={(e) => onFiltersChange({ ...filters, minScore: +e.target.value })}
            className="w-20 accent-accent"
          />
          <span className="font-bold tabular text-accent-dark w-5 text-right" style={{ fontSize: 12 }}>
            {filters.minScore}
          </span>
        </div>

        {availableSignals.length > 0 && (
          <>
            <div className="w-px bg-black/10 self-stretch min-h-[16px]" />
            <div className="flex items-center gap-1.5 flex-wrap">
              <Pill
                label="Tous"
                active={filters.signalType === 'all'}
                onClick={() => onFiltersChange({ ...filters, signalType: 'all' })}
                activeClass="bg-ink text-canvas"
              />
              {availableSignals.map((sig) => (
                <Pill
                  key={sig}
                  label={SIGNAL_META[sig].label}
                  active={filters.signalType === sig}
                  onClick={() => onFiltersChange({ ...filters, signalType: sig })}
                  activeClass="bg-accent/15 text-accent-dark"
                />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="uppercase text-mute tracking-widest mr-1" style={{ fontSize: 9, letterSpacing: '0.15em' }}>
            Statut
          </span>
          <Pill
            label="Tous"
            active={filters.status === 'all'}
            onClick={() => onFiltersChange({ ...filters, status: 'all' })}
            activeClass="bg-ink text-canvas"
          />
          {STATUS_ORDER.map((s) => (
            <Pill
              key={s}
              label={STATUS_META[s].label}
              active={filters.status === s}
              onClick={() => onFiltersChange({ ...filters, status: s })}
              activeClass={STATUS_META[s].chipClass}
            />
          ))}
        </div>
        {isDirty && (
          <button
            type="button"
            onClick={reset}
            className="text-mute hover:text-ink transition-colors uppercase tracking-widest flex-shrink-0"
            style={{ fontSize: 9, letterSpacing: '0.15em' }}
          >
            Réinitialiser
          </button>
        )}
      </div>

      {showAssignedFilter && (
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-black/[0.06]">
          <label className="flex items-center gap-2">
            <span className="uppercase text-mute tracking-widest whitespace-nowrap" style={{ fontSize: 9, letterSpacing: '0.15em' }}>
              Assigné à
            </span>
            <select
              className={selectClass}
              value={filters.assignedTo}
              onChange={(e) =>
                onFiltersChange({ ...filters, assignedTo: e.target.value as Filters['assignedTo'] })
              }
            >
              <option value="all">Tous</option>
              <option value="unassigned">Non assigné</option>
              {teamMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.fullName}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
    </div>
  );
}
