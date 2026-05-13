'use client';

import { useEffect, useState } from 'react';
import type { Agent, Filters, LeadSegmentTab, LeadStatus, LeadZoneId } from '@/types/lead';
import { getSignalPills, statusPills } from '@/components/dashboard/FiltersBar';

interface ZoneOpt { id: LeadZoneId; label: string }

interface ProspectsFiltersSheetProps {
  open: boolean;
  onClose: () => void;
  segmentTab: LeadSegmentTab;
  appliedFilters: Filters;
  onApply: (f: Filters) => void;
  agents: Agent[];
  zones: ZoneOpt[];
  showAssignedFilter?: boolean;
}

function Pill({
  label, active, onClick, activeClass,
}: {
  label: string; active: boolean; onClick: () => void; activeClass: string;
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

const selectClass =
  'w-full min-h-[44px] rounded-lg border border-black/10 px-[14px] py-2.5 text-[14px] text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25';

export default function ProspectsFiltersSheet({
  open,
  onClose,
  segmentTab,
  appliedFilters,
  onApply,
  agents,
  zones,
  showAssignedFilter = true,
}: ProspectsFiltersSheetProps) {
  const [draft, setDraft] = useState<Filters>(appliedFilters);

  useEffect(() => {
    if (open) setDraft(appliedFilters);
  }, [open, appliedFilters]);

  if (!open) return null;

  const signalPills = getSignalPills(segmentTab);

  const resetDraft = () =>
    setDraft({ minScore: 0, signalType: 'all', status: 'all', assignedTo: 'all', zoneId: 'all' });

  const isDirty =
    draft.minScore > 0 ||
    draft.signalType !== 'all' ||
    draft.status !== 'all' ||
    (showAssignedFilter && draft.assignedTo !== 'all') ||
    draft.zoneId !== 'all';

  return (
    <div className="fixed inset-0 z-[80] md:hidden" role="dialog" aria-modal="true" aria-labelledby="filters-sheet-title">
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

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4" style={{ paddingBottom: 'env(safe-area-inset-bottom, 12px)' }}>
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

          <div className="mb-5">
            <p className="mb-2 font-medium text-gray-700" style={{ fontSize: 14 }}>
              Signaux
            </p>
            <div className="flex flex-wrap gap-2">
              {signalPills.map((p) => (
                <Pill
                  key={p.value}
                  label={p.label}
                  active={draft.signalType === p.value}
                  onClick={() => setDraft({ ...draft, signalType: p.value })}
                  activeClass={p.value === 'all' ? 'bg-ink text-white' : 'bg-accent/15 text-accent-dark'}
                />
              ))}
            </div>
          </div>

          <div className="mb-5">
            <p className="mb-2 font-medium text-gray-700" style={{ fontSize: 14 }}>
              Statut
            </p>
            <div className="flex flex-wrap gap-2">
              {statusPills.map((p) => (
                <Pill
                  key={p.value}
                  label={p.label}
                  active={draft.status === p.value}
                  onClick={() => setDraft({ ...draft, status: p.value })}
                  activeClass={
                    p.value === 'all'
                      ? 'bg-ink text-white'
                      : p.value === 'nouveau'
                        ? 'bg-blue/15 text-blue-dark'
                        : p.value === 'contacté'
                          ? 'bg-accent/15 text-accent-dark'
                          : p.value === 'intéressé'
                            ? 'bg-emerald-500/15 text-emerald-700'
                            : p.value === 'rdv_pris'
                              ? 'bg-violet-500/15 text-violet-800'
                              : 'bg-black/[0.1] text-mute'
                  }
                />
              ))}
            </div>
          </div>

          {showAssignedFilter && (
          <div className="mb-5">
            <label className="mb-2 block font-medium text-gray-700" style={{ fontSize: 14 }}>
              Assigné à
            </label>
            <select
              className={selectClass}
              value={draft.assignedTo}
              onChange={(e) => setDraft({ ...draft, assignedTo: e.target.value as Filters['assignedTo'] })}
            >
              <option value="all">Tous</option>
              <option value="unassigned">Non assigné</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          )}

          <div className="mb-4">
            <label className="mb-2 block font-medium text-gray-700" style={{ fontSize: 14 }}>
              Zone
            </label>
            <select
              className={selectClass}
              value={draft.zoneId}
              onChange={(e) => setDraft({ ...draft, zoneId: e.target.value as Filters['zoneId'] })}
            >
              <option value="all">Toutes les zones</option>
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.label}
                </option>
              ))}
            </select>
          </div>
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
