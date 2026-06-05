'use client';

import { useId, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import Select from '@/components/ui/Select';
import type { Filters, Lead, LeadStatus, TeamMember } from '@/types/lead';
import { STATUS_META, STATUS_ORDER } from '@/lib/lead-meta';
import {
  availableDisplayFamilies,
  countActiveLeadFilters,
  DISPLAY_FAMILY_LABELS,
  leadFiltersAreDirty,
  patchLeadFilters,
  resetLeadFilters,
  SCORE_TIER_LABELS,
  showPropertyFilterSection,
  type DisplayFamilyKey,
  type ScoreTierFilter,
} from '@/lib/lead-filters';

interface ProspectsFiltersPanelProps {
  filters: Filters;
  onFiltersChange: (f: Filters) => void;
  teamMembers: TeamMember[];
  /** Prospects de l'onglet courant — pour n'afficher que les filtres pertinents. */
  leads: Lead[];
  showAssignedFilter?: boolean;
  className?: string;
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

const SCORE_TIERS: ScoreTierFilter[] = ['all', 'ultra_hot', 'hot'];

function PriorityFilterSection({
  filters,
  onPatch,
}: {
  filters: Filters;
  onPatch: (patch: Partial<Filters>) => void;
}) {
  return (
    <div className="mb-4">
      <SectionLabel>Priorité</SectionLabel>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {SCORE_TIERS.map((tier) => (
          <Pill
            key={tier}
            label={SCORE_TIER_LABELS[tier]}
            active={filters.scoreTier === tier}
            onClick={() =>
              onPatch({
                scoreTier: tier === 'all' ? 'all' : filters.scoreTier === tier ? 'all' : tier,
              })
            }
          />
        ))}
      </div>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={filters.minScore}
          onChange={(e) => onPatch({ minScore: +e.target.value })}
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
    </div>
  );
}

export default function ProspectsFiltersPanel({
  filters,
  onFiltersChange,
  teamMembers,
  leads,
  showAssignedFilter = true,
  className = '',
  plain = false,
}: ProspectsFiltersPanelProps) {
  const panelId = useId();
  const [expanded, setExpanded] = useState(false);
  const collapsible = !plain;

  const set = (patch: Partial<Filters>) => onFiltersChange(patchLeadFilters(filters, patch));

  const dirty = leadFiltersAreDirty(filters, { countAssigned: showAssignedFilter });
  const activeCount = countActiveLeadFilters(filters, { countAssigned: showAssignedFilter });

  const displayFamilies = useMemo(() => availableDisplayFamilies(leads), [leads]);
  const propertyAvailability = useMemo(() => showPropertyFilterSection(leads), [leads]);

  const showPropertySection =
    propertyAvailability.passoire ||
    propertyAvailability.dpeUnder30 ||
    propertyAvailability.detention5to9 ||
    propertyAvailability.prixAchat;

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
        className="mb-3 flex items-center justify-between gap-3"
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
            onClick={() => onFiltersChange(resetLeadFilters())}
            className="flex-shrink-0 text-mute transition-colors hover:text-ink"
            style={{ fontSize: 12, fontWeight: 500 }}
          >
            Réinitialiser
          </button>
        )}
      </div>

      <PriorityFilterSection filters={filters} onPatch={set} />

      {(!collapsible || expanded) && (
        <div
          id={`${panelId}-body`}
          role="region"
          aria-labelledby={collapsible ? `${panelId}-trigger` : undefined}
        >
          {displayFamilies.length > 0 && (
            <>
              <div className="my-4 border-t border-black/[0.06]" />
              <SectionLabel>Signaux détectés</SectionLabel>
              <div className="mb-4 flex flex-wrap gap-1.5">
                <Pill
                  label="Tous"
                  active={filters.signalFamily === 'all'}
                  onClick={() => set({ signalFamily: 'all' })}
                />
                {displayFamilies.map((family: DisplayFamilyKey) => (
                  <Pill
                    key={family}
                    label={DISPLAY_FAMILY_LABELS[family]}
                    active={filters.signalFamily === family}
                    onClick={() =>
                      set({
                        signalFamily:
                          filters.signalFamily === family ? 'all' : family,
                      })
                    }
                  />
                ))}
              </div>
            </>
          )}

          {showPropertySection && (
            <>
              <div className="my-4 border-t border-black/[0.06]" />
              <SectionLabel>Le bien</SectionLabel>
              <div className="mb-4 flex flex-wrap gap-1.5">
                {propertyAvailability.passoire && (
                  <Pill
                    label="Passoire F/G"
                    active={filters.passoireOnly}
                    onClick={() => set({ passoireOnly: !filters.passoireOnly })}
                  />
                )}
                {propertyAvailability.dpeUnder30 && (
                  <Pill
                    label="DPE refait < 30 j"
                    active={filters.dpeUnder30Only}
                    onClick={() => set({ dpeUnder30Only: !filters.dpeUnder30Only })}
                  />
                )}
                {propertyAvailability.detention5to9 && (
                  <Pill
                    label="Détention 5-9 ans"
                    active={filters.detention5to9}
                    onClick={() => set({ detention5to9: !filters.detention5to9 })}
                  />
                )}
                {propertyAvailability.prixAchat && (
                  <Pill
                    label="Prix d'achat connu"
                    active={filters.prixAchatConnu}
                    onClick={() => set({ prixAchatConnu: !filters.prixAchatConnu })}
                  />
                )}
              </div>
            </>
          )}

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
