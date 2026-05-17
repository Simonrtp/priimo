'use client';

import { useEffect, useState } from 'react';
import Select from '@/components/ui/Select';
import type { Filters, SignalType, TeamMember } from '@/types/lead';
import { STATUS_META, STATUS_ORDER, SIGNAL_META } from '@/lib/lead-meta';

interface ProspectsFiltersSheetProps {
  open: boolean;
  onClose: () => void;
  appliedFilters: Filters;
  onApply: (f: Filters) => void;
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
      className={`min-h-[36px] rounded-full px-3 py-1.5 font-medium transition-colors ${
        active ? activeClass : 'bg-black/[0.06] text-mute'
      }`}
      style={{ fontSize: 12 }}
    >
      {label}
    </button>
  );
}

const sheetSelectTriggerClass =
  'flex w-full min-h-[44px] items-center justify-between gap-2 rounded-xl border border-black/10 bg-white px-[14px] py-2.5 text-left text-[14px] text-ink transition-colors hover:border-black/15 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25';

export default function ProspectsFiltersSheet({
  open,
  onClose,
  appliedFilters,
  onApply,
  teamMembers,
  availableSignals,
  showAssignedFilter = true,
}: ProspectsFiltersSheetProps) {
  const [draft, setDraft] = useState<Filters>(appliedFilters);

  useEffect(() => {
    if (open) setDraft(appliedFilters);
  }, [open, appliedFilters]);

  if (!open) return null;

  const resetDraft = () =>
    setDraft({ minScore: 0, signalType: 'all', status: 'all', assignedTo: 'all' });

  const isDirty =
    draft.minScore > 0 ||
    draft.signalType !== 'all' ||
    draft.status !== 'all' ||
    (showAssignedFilter && draft.assignedTo !== 'all');

  const assignedOptions = [
    { value: 'all', label: 'Tous' },
    { value: 'unassigned', label: 'Non assigné' },
    ...teamMembers.map((m) => ({ value: m.id, label: m.fullName })),
  ];

  return (
    <div
      className="fixed inset-0 z-[80] md:hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="filters-sheet-title"
    >
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Fermer" onClick={onClose} />
      <div className="absolute bottom-0 left-0 right-0 flex max-h-[90vh] flex-col rounded-t-2xl bg-white shadow-xl">
        <div className="flex flex-shrink-0 items-center justify-between border-b border-black/8 px-4 py-3">
          <h2 id="filters-sheet-title" className="font-semibold text-ink" style={{ fontSize: 17 }}>
            Filtres
          </h2>
          <div className="flex items-center gap-2">
            {isDirty && (
              <button type="button" className="text-[13px] font-medium text-accent-dark" onClick={resetDraft}>
                Réinitialiser
              </button>
            )}
            <button
              type="button"
              className="flex h-11 w-11 items-center justify-center rounded-lg text-mute hover:bg-black/[0.05]"
              onClick={onClose}
              aria-label="Fermer"
            >
              <span className="text-xl leading-none">×</span>
            </button>
          </div>
        </div>

        <div
          className="min-h-0 flex-1 overflow-y-auto px-4 py-4"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 12px)' }}
        >
          <div className="mb-5">
            <label className="mb-2 block font-medium text-gray-700" style={{ fontSize: 14 }}>
              Score minimum
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={draft.minScore}
                onChange={(e) => setDraft({ ...draft, minScore: +e.target.value })}
                className="h-2 flex-1 accent-accent"
              />
              <span className="w-8 text-right font-bold tabular text-accent-dark">{draft.minScore}</span>
            </div>
          </div>

          {availableSignals.length > 0 && (
            <div className="mb-5">
              <p className="mb-2 font-medium text-gray-700" style={{ fontSize: 14 }}>
                Signaux
              </p>
              <div className="flex flex-wrap gap-2">
                <Pill
                  label="Tous"
                  active={draft.signalType === 'all'}
                  onClick={() => setDraft({ ...draft, signalType: 'all' })}
                  activeClass="bg-ink text-white"
                />
                {availableSignals.map((sig) => (
                  <Pill
                    key={sig}
                    label={SIGNAL_META[sig].label}
                    active={draft.signalType === sig}
                    onClick={() => setDraft({ ...draft, signalType: sig })}
                    activeClass="bg-accent/15 text-accent-dark"
                  />
                ))}
              </div>
            </div>
          )}

          <div className="mb-5">
            <p className="mb-2 font-medium text-gray-700" style={{ fontSize: 14 }}>
              Statut
            </p>
            <div className="flex flex-wrap gap-2">
              <Pill
                label="Tous"
                active={draft.status === 'all'}
                onClick={() => setDraft({ ...draft, status: 'all' })}
                activeClass="bg-ink text-white"
              />
              {STATUS_ORDER.map((s) => (
                <Pill
                  key={s}
                  label={STATUS_META[s].label}
                  active={draft.status === s}
                  onClick={() => setDraft({ ...draft, status: s })}
                  activeClass={STATUS_META[s].chipClass}
                />
              ))}
            </div>
          </div>

          {showAssignedFilter && (
            <div className="mb-5">
              <label className="mb-2 block font-medium text-gray-700" style={{ fontSize: 14 }}>
                Assigné à
              </label>
              <Select
                aria-label="Assigné à"
                value={draft.assignedTo}
                options={assignedOptions}
                triggerClassName={sheetSelectTriggerClass}
                onChange={(v) => setDraft({ ...draft, assignedTo: v as Filters['assignedTo'] })}
              />
            </div>
          )}
        </div>

        <div
          className="flex-shrink-0 border-t border-black/8 bg-white p-4"
          style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
        >
          <button
            type="button"
            className="btn btn-primary w-full min-h-[48px]"
            style={{ borderRadius: 10, fontSize: 15 }}
            onClick={() => {
              onApply(draft);
              onClose();
            }}
          >
            Appliquer
          </button>
        </div>
      </div>
    </div>
  );
}
