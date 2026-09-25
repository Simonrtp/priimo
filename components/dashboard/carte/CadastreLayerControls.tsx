'use client';

import { useRef, useState, type PointerEvent } from 'react';
import './carte.css';
import { ChevronDown } from 'lucide-react';
import {
  CADASTRE_LAYER_LABELS,
  CADASTRE_OVERLAY_IDS,
  anyCadastreLayer,
  type CadastreOverlayId,
  type MapLayerState,
} from '@/lib/carte/layers';
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

const SLATE = '#1A2A56';
const THUMB_PAD = 14;

function overlayKey(id: CadastreOverlayId): keyof Pick<
  MapLayerState,
  'cadastreDpe' | 'cadastreVentes' | 'cadastreCopro'
> {
  if (id === 'dpe') return 'cadastreDpe';
  if (id === 'ventes') return 'cadastreVentes';
  return 'cadastreCopro';
}

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
    <div className={disabled ? 'pointer-events-none opacity-55' : undefined}>
      <p className="mb-1.5 text-pretty text-[12.5px] font-medium text-text-strong">{phrase}</p>
      <div
        ref={railRef}
        className={`priimo-dpe-age${active ? ' priimo-dpe-age--dragging' : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="priimo-dpe-age__track" aria-hidden>
          <span className="priimo-dpe-age__marks">
            {DPE_AGE_BUCKETS.map((bucket, i) => (
              <span
                key={bucket}
                className="priimo-dpe-age__mark"
                style={{ left: `${(i / max) * 100}%` }}
              />
            ))}
          </span>
          <span
            className="priimo-dpe-age__fill"
            style={{ left: `${startPct}%`, width: `${Math.max(endPct - startPct, 0)}%` }}
          />
        </div>
        <input
          type="range"
          min={0}
          max={max}
          step={1}
          value={from}
          disabled={disabled}
          tabIndex={disabled ? -1 : 0}
          aria-label="DPE les plus récents à montrer"
          aria-valuetext={DPE_AGE_LABELS[DPE_AGE_BUCKETS[from]]}
          className={`priimo-dpe-age__input priimo-dpe-age__input--from${
            active === 'from' ? ' priimo-dpe-age__input--active' : ''
          }`}
          onChange={(e) => {
            const next = Number(e.target.value);
            onChange(Math.min(next, to), to);
          }}
        />
        <input
          type="range"
          min={0}
          max={max}
          step={1}
          value={to}
          disabled={disabled}
          tabIndex={disabled ? -1 : 0}
          aria-label="DPE les plus anciens à montrer"
          aria-valuetext={DPE_AGE_LABELS[DPE_AGE_BUCKETS[to]]}
          className={`priimo-dpe-age__input priimo-dpe-age__input--to${
            active === 'to' ? ' priimo-dpe-age__input--active' : ''
          }`}
          onChange={(e) => {
            const next = Number(e.target.value);
            onChange(from, Math.max(next, from));
          }}
        />
      </div>
      <div className="mt-0.5 flex justify-between gap-0.5">
        {DPE_AGE_BUCKETS.map((bucket, i) => {
          const on = i >= from && i <= to;
          return (
            <button
              key={bucket}
              type="button"
              tabIndex={-1}
              disabled={disabled}
              aria-label={DPE_AGE_LABELS[bucket]}
              onClick={() => snapTick(i)}
              className={`min-h-8 min-w-0 flex-1 rounded-md px-0.5 text-center text-[11px] leading-tight transition-colors duration-fluid-subtle ease-in-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent disabled:cursor-not-allowed ${
                on ? 'font-semibold text-text-strong' : 'font-medium text-text-subtle'
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

export default function CadastreLayerControls({
  layers,
  onToggleOverlay,
  onChangeDpeAge,
  onToggleMenu,
  mapZoom,
  compact = false,
}: {
  layers: MapLayerState;
  onToggleOverlay: (id: CadastreOverlayId) => void;
  onChangeDpeAge: (from: number, to: number) => void;
  onToggleMenu: () => void;
  mapZoom: number | null;
  compact?: boolean;
}) {
  const open = layers.cadastreMenuOpen;
  const tooFarPoints = mapZoom !== null && mapZoom < CADASTRE_OVERLAY_MIN_ZOOM;
  const row = compact ? 'min-h-[44px]' : 'min-h-[40px]';
  const pad = compact ? 'px-1' : 'px-2.5 py-1.5';
  const folderOn = anyCadastreLayer(layers);

  return (
    <li>
      <button
        type="button"
        aria-expanded={open}
        aria-label={open ? 'Replier Cadastre' : 'Déplier Cadastre'}
        onClick={onToggleMenu}
        className={`flex w-full ${row} items-center gap-3 rounded-xl ${pad} text-left transition-colors duration-fluid-subtle ease-in-out hover:bg-[#E8EBEF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
          folderOn ? 'bg-[#EEF0F3]' : 'bg-[#F5F6F8]'
        }`}
      >
        <span
          className={`min-w-0 flex-1 text-[13.5px] font-medium ${
            folderOn ? 'text-text-strong' : 'text-text-muted'
          }`}
        >
          <span className="flex items-center gap-2">
            Cadastre
            <span
              className={`relative shrink-0 overflow-hidden rounded-[3px] ring-1 ring-black/[0.08] ${
                compact ? 'h-3 w-6' : 'h-3.5 w-7'
              }`}
              title="Données publiques — République française"
            >
              <img
                src="/marianne.svg"
                alt=""
                width={28}
                height={14}
                className="size-full object-cover"
              />
            </span>
          </span>
        </span>
        <ChevronDown
          size={16}
          strokeWidth={2}
          aria-hidden
          className={`shrink-0 text-text-subtle transition-transform duration-fluid-subtle ease-in-out ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>
      <div
        className={`fluid-collapse ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
        aria-hidden={!open}
      >
        <ul className={`mt-1 flex flex-col gap-0.5 ${compact ? 'pl-4' : 'pl-7'}`}>
          {CADASTRE_OVERLAY_IDS.map((id) => {
            const key = overlayKey(id);
            const active = layers[key];
            return (
              <li key={id} className={`rounded-xl ${pad}`}>
                <label
                  className={`flex ${row} cursor-pointer items-center gap-3 transition-colors duration-fluid-subtle ease-in-out ${
                    tooFarPoints ? 'opacity-55' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    className="size-4 rounded border-black/20"
                    style={{ accentColor: SLATE }}
                    checked={active}
                    onChange={() => onToggleOverlay(id)}
                  />
                  <span
                    className={`min-w-0 flex-1 text-[13.5px] font-medium ${
                      active && !tooFarPoints ? 'text-text-strong' : 'text-text-muted'
                    }`}
                  >
                    {CADASTRE_LAYER_LABELS[id]}
                    {tooFarPoints ? (
                      <span className="mt-0.5 block text-[11.5px] font-normal text-text-subtle">
                        Zoomez pour afficher
                      </span>
                    ) : null}
                  </span>
                </label>
                {id === 'dpe' ? (
                  <div className="mt-1.5">
                    <DpeAgeSlider
                      ages={layers.cadastreDpeAges}
                      disabled={!layers.cadastreDpe}
                      onChange={onChangeDpeAge}
                    />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    </li>
  );
}
