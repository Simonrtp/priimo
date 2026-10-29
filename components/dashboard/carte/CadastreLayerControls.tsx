'use client';

import { useRef, useState, type PointerEvent } from 'react';
import './carte.css';
import Switch from '@/components/ui/Switch';
import type { CadastreLayerId, MapLayerState } from '@/lib/carte/layers';
import {
  DPE_AGE_BUCKETS,
  DPE_AGE_LABELS,
  DPE_AGE_LAST,
  DPE_AGE_TICK_LABELS,
  dpeAgeIndexFromRatio,
  dpeAgeNearerHandle,
  dpeAgeRangePhrase,
  dpeAgeSpan,
  type DpeAgeBucket,
} from '@/lib/carte/dpe-age';
import { CADASTRE_OVERLAY_MIN_ZOOM } from '@/lib/carte/parcelle';
import IconDpeEtiquette from '@/components/dashboard/carte/IconDpeEtiquette';

const THUMB_PAD = 14;

function DpeAgeSlider({
  ages,
  disabled,
  onChange,
}: {
  ages: readonly DpeAgeBucket[];
  disabled: boolean;
  onChange: (from: number, to: number) => void;
}) {
  const { from, to } = dpeAgeSpan(ages);
  const railRef = useRef<HTMLDivElement>(null);
  const spanRef = useRef({ from, to });
  spanRef.current = { from, to };
  const dragRef = useRef<{
    handle: 'from' | 'to' | 'split';
    pointerId: number;
  } | null>(null);
  const [active, setActive] = useState<'from' | 'to' | null>(null);

  const max = DPE_AGE_LAST;
  const startPct = (from / max) * 100;
  const endPct = (to / max) * 100;
  const phrase = dpeAgeRangePhrase(from, to);

  function commit(handle: 'from' | 'to', index: number) {
    const cur = spanRef.current;
    const next =
      handle === 'from'
        ? { from: Math.min(index, cur.to), to: cur.to }
        : { from: cur.from, to: Math.max(index, cur.from) };
    spanRef.current = next;
    onChange(next.from, next.to);
  }

  function indexFromClientX(clientX: number): number {
    const el = railRef.current;
    if (!el) return spanRef.current.from;
    const rect = el.getBoundingClientRect();
    const inner = rect.width - THUMB_PAD * 2;
    if (inner <= 0) return spanRef.current.from;
    return dpeAgeIndexFromRatio((clientX - rect.left - THUMB_PAD) / inner);
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (disabled || e.button !== 0) return;
    const cur = spanRef.current;
    const index = indexFromClientX(e.clientX);
    let handle: 'from' | 'to' | 'split';
    if (cur.from === cur.to && index === cur.from) {
      handle = 'split';
    } else {
      handle = dpeAgeNearerHandle(index, cur.from, cur.to);
      commit(handle, index);
    }
    dragRef.current = { handle, pointerId: e.pointerId };
    setActive(handle === 'split' ? null : handle);
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const index = indexFromClientX(e.clientX);
    const cur = spanRef.current;
    if (drag.handle === 'split') {
      if (index === cur.from) return;
      const handle = index < cur.from ? 'from' : 'to';
      drag.handle = handle;
      setActive(handle);
      commit(handle, index);
      return;
    }
    commit(drag.handle, index);
  }

  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
    setActive(null);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }

  function snapTick(index: number) {
    if (disabled) return;
    const cur = spanRef.current;
    commit(dpeAgeNearerHandle(index, cur.from, cur.to), index);
  }

  return (
    <div className={`select-none ${disabled ? 'opacity-45' : ''}`}>
      <p className="mb-1.5 text-[11.5px] font-medium text-text-muted">{phrase}</p>
      <div
        ref={railRef}
        role="group"
        aria-label="Ancienneté des DPE"
        aria-disabled={disabled || undefined}
        className={`relative h-8 touch-none ${disabled ? 'pointer-events-none' : 'cursor-pointer'}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="pointer-events-none absolute inset-x-[14px] top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-black/[0.08]" />
        <div
          className="pointer-events-none absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-[#1A2A56]/55"
          style={{
            left: `calc(${THUMB_PAD}px + (100% - ${THUMB_PAD * 2}px) * ${startPct / 100})`,
            right: `calc(${THUMB_PAD}px + (100% - ${THUMB_PAD * 2}px) * ${(100 - endPct) / 100})`,
          }}
        />
        {(['from', 'to'] as const).map((handle) => {
          const index = handle === 'from' ? from : to;
          const pct = (index / max) * 100;
          const focus = active === handle;
          return (
            <span
              key={handle}
              aria-hidden
              className={`pointer-events-none absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#1A2A56] shadow-sm ${
                focus ? 'ring-2 ring-[#1A2A56]/25' : ''
              }`}
              style={{ left: `calc(${THUMB_PAD}px + (100% - ${THUMB_PAD * 2}px) * ${pct / 100})` }}
              title={DPE_AGE_LABELS[DPE_AGE_BUCKETS[index]]}
            />
          );
        })}
      </div>
      <div className="mt-0.5 flex justify-between gap-0.5 px-0.5">
        {DPE_AGE_BUCKETS.map((bucket, index) => {
          const on = index >= from && index <= to;
          return (
            <button
              key={bucket}
              type="button"
              disabled={disabled}
              onClick={() => snapTick(index)}
              className={`min-h-7 shrink-0 whitespace-nowrap rounded-full px-2 py-1 text-[11px] leading-none transition-colors duration-fluid-subtle ease-in-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent disabled:cursor-not-allowed ${
                on ? 'bg-[#1A2A56]/10 font-semibold text-text-strong' : 'font-medium text-text-subtle hover:bg-black/[0.04]'
              }`}
            >
              {DPE_AGE_TICK_LABELS[bucket]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Carte DPE : même structure que Annonces — titre, pastille, puis filtres. */
export default function CadastreLayerControls({
  layers,
  onToggleLayer,
  onChangeDpeAge,
  mapZoom,
  compact = false,
}: {
  layers: MapLayerState;
  onToggleLayer: (id: CadastreLayerId) => void;
  onChangeDpeAge: (from: number, to: number) => void;
  /** Conservé pour compatibilité des appelants ; le menu Cadastre n’existe plus. */
  onToggleMenu?: () => void;
  mapZoom: number | null;
  compact?: boolean;
}) {
  const tooFarPoints = mapZoom !== null && mapZoom < CADASTRE_OVERLAY_MIN_ZOOM;
  const voir = layers.cadastreDpe;
  const textSize = compact ? 'text-[14.5px]' : 'text-[13.5px]';
  const row = compact ? 'min-h-[44px]' : 'min-h-[40px]';

  return (
    <li className="rounded-[14px] bg-[#E6E8EB]/90">
      <div className={`flex flex-col gap-2.5 ${compact ? 'px-1 py-2' : 'px-2.5 py-2.5'}`}>
        <p className={`${textSize} flex min-w-0 items-center gap-2.5 overflow-visible font-medium text-text-strong`}>
          <IconDpeEtiquette className={`shrink-0 ${compact ? 'size-9' : 'size-10'}`} />
          <span className="truncate">DPE</span>
        </p>
        <button
          type="button"
          role="switch"
          aria-checked={voir}
          onClick={() => onToggleLayer('dpe')}
          className={`flex w-full ${row} cursor-pointer items-center gap-3 rounded-xl text-left transition-colors duration-fluid-subtle ease-in-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1A2A56] ${
            tooFarPoints ? 'opacity-55' : ''
          }`}
        >
          <Switch checked={voir} />
          <span
            className={`min-w-0 flex-1 text-[13.5px] font-medium ${
              voir && !tooFarPoints ? 'text-text-strong' : 'text-text-muted'
            }`}
          >
            Voir mes DPE
            {tooFarPoints ? (
              <span className="mt-0.5 block text-[11.5px] font-normal text-text-subtle">
                Zoomez pour afficher
              </span>
            ) : null}
          </span>
        </button>
        {voir ? (
          <div className="px-0.5 pb-0.5">
            <DpeAgeSlider ages={layers.cadastreDpeAges} disabled={false} onChange={onChangeDpeAge} />
          </div>
        ) : null}
      </div>
    </li>
  );
}
