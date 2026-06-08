'use client';

import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import type { Filters, Lead, TeamMember } from '@/types/lead';
import {
  countActiveLeadFilters,
  leadFiltersAreDirty,
  resetLeadFilters,
} from '@/lib/lead-filters';
import ProspectsFiltersPanel from './ProspectsFiltersPanel';

interface ProspectsFiltersSheetProps {
  open: boolean;
  onClose: () => void;
  appliedFilters: Filters;
  onApply: (f: Filters) => void;
  teamMembers: TeamMember[];
  leads: Lead[];
  showAssignedFilter?: boolean;
}

export default function ProspectsFiltersSheet({
  open,
  onClose,
  appliedFilters,
  onApply,
  teamMembers,
  leads,
  showAssignedFilter = true,
}: ProspectsFiltersSheetProps) {
  const [draft, setDraft] = useState<Filters>(appliedFilters);

  useEffect(() => {
    if (open) setDraft(appliedFilters);
  }, [open, appliedFilters]);

  const dirty = useMemo(
    () => leadFiltersAreDirty(draft, { countAssigned: showAssignedFilter }),
    [draft, showAssignedFilter],
  );
  const activeCount = useMemo(
    () => countActiveLeadFilters(draft, { countAssigned: showAssignedFilter }),
    [draft, showAssignedFilter],
  );

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
      <div className="absolute bottom-0 left-0 right-0 flex max-h-[min(90dvh,720px)] flex-col rounded-t-2xl bg-white shadow-xl">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-black/8 px-4 py-3">
          <div className="min-w-0">
            <h2
              id="filters-sheet-title"
              className="font-semibold text-ink"
              style={{ fontSize: 17, letterSpacing: '-0.01em' }}
            >
              Filtres
            </h2>
            {activeCount > 0 && (
              <p className="mt-0.5 text-mute" style={{ fontSize: 12 }}>
                {activeCount} actif{activeCount > 1 ? 's' : ''}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {dirty && (
              <button
                type="button"
                onClick={() => setDraft(resetLeadFilters())}
                className="rounded-lg px-2 py-2 text-mute transition-colors hover:bg-black/[0.04] hover:text-ink"
                style={{ fontSize: 12, fontWeight: 500 }}
              >
                Réinitialiser
              </button>
            )}
            <button
              type="button"
              className="flex size-11 items-center justify-center rounded-lg text-mute transition-colors hover:bg-black/[0.05] hover:text-ink"
              onClick={onClose}
              aria-label="Fermer"
            >
              <X size={20} strokeWidth={2} aria-hidden />
            </button>
          </div>
        </div>

        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 12px)' }}
        >
          <ProspectsFiltersPanel
            plain
            hideHeader
            filters={draft}
            onFiltersChange={setDraft}
            teamMembers={teamMembers}
            leads={leads}
            showAssignedFilter={showAssignedFilter}
          />
        </div>

        <div
          className="shrink-0 border-t border-black/8 bg-white p-4"
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
