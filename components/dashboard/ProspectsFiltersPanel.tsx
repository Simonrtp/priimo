'use client';

import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import Select from '@/components/ui/Select';
import type { Filters, LeadStatus, SignalType, TeamMember } from '@/types/lead';
import { STATUS_META, STATUS_ORDER, SIGNAL_META } from '@/lib/lead-meta';
import {
  advancedSignalTypes,
  countActiveFilters,
  filtersAreDirty,
  patchFilters,
  resetFilters,
} from '@/lib/filter-state';
import ProspectQuickFilters from './ProspectQuickFilters';

interface ProspectsFiltersPanelProps {
  filters: Filters;
  onFiltersChange: (f: Filters) => void;
  teamMembers: TeamMember[];
  availableSignals: SignalType[];
  showAssignedFilter?: boolean;
  className?: string;
  /** Sans carte (sheet mobile). */
  plain?: boolean;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="mb-2 uppercase tracking-widest text-mute"
      style={{ fontSize: 9, letterSpacing: '0.15em' }}
    >
      {children}
    </p>
  );
}

const PILL_ACTIVE_CLASS = 'bg-ink text-canvas';

function Pill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full font-medium transition-colors duration-150 ${
        active ? PILL_ACTIVE_CLASS : 'bg-black/[0.05] text-mute hover:bg-black/[0.09] hover:text-ink'
      }`}
      style={{ fontSize: 11.5, padding: '5px 12px', letterSpacing: '0.01em' }}
    >
      {label}
    </button>
  );
}

export default function ProspectsFiltersPanel({
  filters,
  onFiltersChange,
  teamMembers,
  availableSignals,
  showAssignedFilter = true,
  className = '',
  plain = false,
}: ProspectsFiltersPanelProps) {
  const panelId = useId();
  const [expanded, setExpanded] = useState(true);
  const collapsible = !plain;

  const set = (patch: Partial<Filters>) => onFiltersChange(patchFilters(filters, patch));

  const dirty = filtersAreDirty(filters, { countAssigned: showAssignedFilter });
  const activeCount = countActiveFilters(filters, { countAssigned: showAssignedFilter });
  const extraSignals = advancedSignalTypes(availableSignals);

  const assignedOptions = [
    { value: 'all', label: 'Tous les collaborateurs' },
    { value: 'unassigned', label: 'Non assigné' },
    ...teamMembers.map((m) => ({ value: m.id, label: m.fullName })),
  ];

  const shellClass = plain
    ? className
    : `rounded-2xl border border-black/8 bg-white px-4 py-4 shadow-soft sm:px-5 ${className}`;

  return (
    <div className={shellClass}>
      <div
        className={`flex items-center justify-between gap-3 ${expanded || !collapsible ? 'mb-4' : ''}`}
      >
        {collapsible ? (
          <button
            type="button"
            id={`${panelId}-trigger`}
            aria-expanded={expanded}
            aria-controls={`${panelId}-body`}
            onClick={() => setExpanded((v) => !v)}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-lg py-1 text-left transition-colors hover:text-ink"
          >
            <span className="font-semibold text-ink" style={{ fontSize: 13, letterSpacing: '-0.01em' }}>
              Filtres
            </span>
            {!expanded && activeCount > 0 && (
              <span
                className="inline-flex items-center rounded-full bg-accent/15 px-2 py-0.5 font-medium tabular text-accent-dark"
                style={{ fontSize: 11 }}
              >
                {activeCount} actif{activeCount > 1 ? 's' : ''}
              </span>
            )}
            <ChevronDown
              className={`ml-auto h-4 w-4 shrink-0 text-mute transition-transform duration-200 ease-out ${
                expanded ? 'rotate-180' : ''
              }`}
              aria-hidden
            />
          </button>
        ) : (
          <p className="font-semibold text-ink" style={{ fontSize: 13, letterSpacing: '-0.01em' }}>
            Filtres
          </p>
        )}
        {dirty && (
          <button
            type="button"
            onClick={() => onFiltersChange(resetFilters())}
            className="flex-shrink-0 text-mute transition-colors hover:text-ink"
            style={{ fontSize: 12, fontWeight: 500 }}
          >
            Réinitialiser
          </button>
        )}
      </div>

      {(!collapsible || expanded) && (
        <div id={`${panelId}-body`} role="region" aria-labelledby={collapsible ? `${panelId}-trigger` : undefined}>
      <ProspectQuickFilters
        value={filters.quickFilter}
        onChange={(quickFilter) => set({ quickFilter })}
        embedded
      />

      <div className="my-4 border-t border-black/[0.06]" />

      <SectionLabel>DPE</SectionLabel>
      <div className="mb-4 flex flex-wrap gap-1.5">
        <Pill
          label="Uniquement DPE < 30 jours"
          active={filters.dpeUnder30Only}
          onClick={() => set({ dpeUnder30Only: !filters.dpeUnder30Only })}
        />
      </div>

      <div className="my-4 border-t border-black/[0.06]" />

      <SectionLabel>Statut</SectionLabel>
      <div className="mb-4 flex flex-wrap gap-1.5">
        <Pill
          label="Tous"
          active={filters.status === 'all'}
          onClick={() => set({ status: 'all' })}
        />
        {STATUS_ORDER.map((s) => (
          <Pill
            key={s}
            label={STATUS_META[s].label}
            active={filters.status === s}
            onClick={() => set({ status: s as LeadStatus })}
          />
        ))}
      </div>

      <SectionLabel>Score minimum</SectionLabel>
      <div className="mb-4 flex items-center gap-3">
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={filters.minScore}
          onChange={(e) => set({ minScore: +e.target.value })}
          className="h-2 min-w-0 flex-1 accent-accent"
          aria-label="Score minimum"
        />
        <span
          className="w-8 flex-shrink-0 text-right font-bold tabular text-accent-dark"
          style={{ fontSize: 13 }}
        >
          {filters.minScore}
        </span>
      </div>

      {extraSignals.length > 0 && (
        <>
          <SectionLabel>Autres signaux</SectionLabel>
          <div className="mb-4 flex flex-wrap gap-1.5">
            {extraSignals.map((sig) => (
              <Pill
                key={sig}
                label={SIGNAL_META[sig].label}
                active={filters.signalType === sig}
                onClick={() =>
                  set({
                    signalType: filters.signalType === sig ? 'all' : sig,
                  })
                }
              />
            ))}
          </div>
        </>
      )}

      {showAssignedFilter && (
        <>
          <div className="mb-4 border-t border-black/[0.06]" />
          <SectionLabel>Assigné à</SectionLabel>
          <Select
            aria-label="Assigné à"
            value={filters.assignedTo}
            options={assignedOptions}
            onChange={(v) => set({ assignedTo: v as Filters['assignedTo'] })}
          />
        </>
      )}
        </div>
      )}
    </div>
  );
}
