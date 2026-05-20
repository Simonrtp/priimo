'use client';

import { useEffect, useState } from 'react';
import type { Filters, SignalType, TeamMember } from '@/types/lead';
import ProspectsFiltersPanel from './ProspectsFiltersPanel';

interface ProspectsFiltersSheetProps {
  open: boolean;
  onClose: () => void;
  appliedFilters: Filters;
  onApply: (f: Filters) => void;
  teamMembers: TeamMember[];
  availableSignals: SignalType[];
  showAssignedFilter?: boolean;
}

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

  return (
    <div
      className="fixed inset-0 z-[80] md:hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="filters-sheet-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Fermer"
        onClick={onClose}
      />
      <div className="absolute bottom-0 left-0 right-0 flex max-h-[90vh] flex-col rounded-t-2xl bg-white shadow-xl">
        <div className="flex flex-shrink-0 items-center justify-end border-b border-black/8 px-4 py-3">
          <button
            type="button"
            className="flex h-11 w-11 items-center justify-center rounded-lg text-mute hover:bg-black/[0.05]"
            onClick={onClose}
            aria-label="Fermer"
          >
            <span className="text-xl leading-none" aria-hidden>
              {'\u00D7'}
            </span>
          </button>
        </div>

        <div
          className="min-h-0 flex-1 overflow-y-auto px-4 py-2"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 12px)' }}
        >
          <ProspectsFiltersPanel
            plain
            filters={draft}
            onFiltersChange={setDraft}
            teamMembers={teamMembers}
            availableSignals={availableSignals}
            showAssignedFilter={showAssignedFilter}
          />
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
