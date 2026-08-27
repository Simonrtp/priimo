'use client';

import { Locate, X } from 'lucide-react';
import type { SortieStop } from '@/lib/today/sortie';
import { FIELD, formatDistance } from '@/lib/today/field';
import { formatWalkingDuration } from '@/lib/today/directions';
import ScoreRing from '@/components/dashboard/ScoreRing';
import { vibrateBrief } from './aujourdhui/tap';

export default function CarteTourneeNavBar({
  active,
  doneN,
  totalN,
  distanceM,
  durationS,
  accuracyM,
  onStop,
  onRecenter,
  onAction,
}: {
  active: SortieStop;
  doneN: number;
  totalN: number;
  distanceM: number;
  durationS: number | null;
  accuracyM: number | null;
  onStop: () => void;
  onRecenter: () => void;
  onAction: (kind: 'rencontre' | 'absent' | 'passer') => void;
}) {
  return (
    <>
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-[25] flex items-start justify-between px-3"
        style={{ paddingTop: 'calc(10px + env(safe-area-inset-top, 0px))' }}
      >
        <button
          type="button"
          onClick={onStop}
          className="pointer-events-auto app-press flex min-h-[44px] items-center gap-1.5 rounded-full bg-white/95 px-3.5 text-[14px] font-medium text-text-strong shadow-md"
        >
          <X size={16} strokeWidth={2.2} aria-hidden />
          Arrêter
        </button>
        <div className="pointer-events-auto flex flex-col items-end gap-1.5">
          <p className="rounded-full bg-white/95 px-3 py-2 text-[13px] font-semibold tabular-nums text-text-strong shadow-md">
            {doneN + 1} / {totalN}
          </p>
          {accuracyM != null && accuracyM > 25 ? (
            <p className="rounded-full bg-[#15202F]/75 px-2.5 py-1 text-[11px] font-medium text-white/90">
              GPS ±{Math.round(accuracyM)} m
            </p>
          ) : null}
        </div>
      </div>

      <button
        type="button"
        onClick={onRecenter}
        aria-label="Recentrer sur ma position"
        className="app-press absolute right-4 z-[25] flex size-12 items-center justify-center rounded-full bg-surface text-text shadow-md"
        style={{ bottom: 'calc(280px + var(--field-nav-height))' }}
      >
        <Locate size={20} strokeWidth={2} aria-hidden />
      </button>

      <div
        className="pointer-events-auto absolute inset-x-0 bottom-0 z-[25] rounded-t-[24px] bg-surface shadow-[0_-8px_32px_rgba(15,23,34,0.2)]"
        style={{ paddingBottom: 'calc(12px + var(--field-nav-height))' }}
      >
        <div className="px-4 pt-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-text-subtle">
            Prochaine adresse
          </p>
          <h2 className="mt-1 text-balance font-semibold text-text-strong" style={{ fontSize: 18, lineHeight: 1.25 }}>
            {active.address}
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-2.5">
            <ScoreRing score={active.score} size={36} />
            <span className="text-[13px] text-text-muted">
              {formatDistance(distanceM)}
              {durationS ? ` · ${formatWalkingDuration(durationS)}` : ''}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 pb-1">
            <ActionBtn label="Rencontré" tone="vert" onClick={() => { vibrateBrief(); onAction('rencontre'); }} />
            <ActionBtn label="Absent" tone="ardoise" onClick={() => { vibrateBrief(); onAction('absent'); }} />
            <ActionBtn label="Passer" tone="muted" onClick={() => { vibrateBrief(); onAction('passer'); }} />
          </div>
        </div>
      </div>
    </>
  );
}

function ActionBtn({
  label,
  tone,
  onClick,
}: {
  label: string;
  tone: 'vert' | 'ardoise' | 'muted';
  onClick: () => void;
}) {
  const style =
    tone === 'vert'
      ? { backgroundColor: FIELD.vert, color: '#fff' }
      : tone === 'ardoise'
        ? { backgroundColor: FIELD.ardoisePastel, color: FIELD.ardoise }
        : { backgroundColor: 'rgba(0,0,0,0.05)', color: '#475569' };
  return (
    <button
      type="button"
      onClick={onClick}
      className="app-press flex min-h-[48px] items-center justify-center rounded-xl text-[13.5px] font-semibold"
      style={style}
    >
      {label}
    </button>
  );
}
