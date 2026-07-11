'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { Filters, Lead, TeamMember } from '@/types/lead';
import {
  countActiveLeadFilters,
  leadFiltersAreDirty,
  resetLeadFilters,
} from '@/lib/lead-filters';
import ClayButton from '@/components/ui/ClayButton';
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

  // Glisser vers le bas pour fermer (bottom sheet natif)
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startYRef = useRef<number | null>(null);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    startYRef.current = e.clientY;
    setDragging(true);
  }, []);
  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (startYRef.current == null) return;
    setDragY(Math.max(0, e.clientY - startYRef.current));
  }, []);
  const endDrag = useCallback(() => {
    if (startYRef.current == null) return;
    startYRef.current = null;
    setDragging(false);
    setDragY((dy) => {
      if (dy > 100) onClose();
      return 0;
    });
  }, [onClose]);

  useEffect(() => {
    if (open) {
      setDraft(appliedFilters);
      setDragY(0);
    }
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
        className="animate-app-scrim absolute inset-0 bg-[rgba(15,10,40,0.42)]"
        aria-label="Fermer"
        onClick={onClose}
      />
      <div
        className="animate-app-sheet absolute bottom-0 left-0 right-0 flex max-h-[min(90dvh,720px)] flex-col rounded-t-[24px] bg-bg-base shadow-[0_-8px_40px_-8px_rgba(30,27,75,0.28)]"
        style={{
          transform: dragY ? `translateY(${dragY}px)` : undefined,
          transition: dragging ? 'none' : 'transform 0.32s cubic-bezier(0.22,1,0.36,1)',
        }}
      >
        {/* Poignée + entête (zone de glissement) */}
        <div
          className="shrink-0 cursor-grab touch-none rounded-t-[24px] bg-bg-base"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <div className="flex justify-center pt-2.5 pb-1">
            <span className="app-grabber" aria-hidden />
          </div>
          <div className="flex items-center justify-between gap-3 px-4 py-2.5">
            <div className="min-w-0">
              <h2
                id="filters-sheet-title"
                className="font-bold text-ink"
                style={{ fontSize: 18, letterSpacing: '-0.02em' }}
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
                  className="app-press rounded-lg px-2 py-2 text-mute transition-colors hover:bg-black/[0.04] hover:text-ink"
                  style={{ fontSize: 12, fontWeight: 500 }}
                >
                  Réinitialiser
                </button>
              )}
              <button
                type="button"
                className="app-press flex size-11 items-center justify-center rounded-full text-mute transition-colors hover:bg-black/[0.05] hover:text-ink"
                onClick={onClose}
                aria-label="Fermer"
              >
                <X size={20} strokeWidth={2} aria-hidden />
              </button>
            </div>
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
          className="app-actionbar shrink-0 p-4"
          style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
        >
          <ClayButton
            className="min-h-[50px] w-full text-[15px]"
            onClick={() => {
              onApply(draft);
              onClose();
            }}
          >
            Appliquer
          </ClayButton>
        </div>
      </div>
    </div>
  );
}
