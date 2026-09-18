'use client';

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
  dpeAgeSpan,
  type DpeAgeBucket,
} from '@/lib/carte/dpe-age';
import { CADASTRE_OVERLAY_MIN_ZOOM } from '@/lib/carte/parcelle';

const SLATE = '#3D5A80';

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
  const max = DPE_AGE_LAST;
  const startPct = (from / max) * 100;
  const endPct = (to / max) * 100;
  const spanPct = Math.max(endPct - startPct, from === to ? 100 / max / 2 : 0);
  return (
    <div className={disabled ? 'opacity-55' : undefined}>
      <div className="priimo-dpe-age">
        <div className="priimo-dpe-age__track" aria-hidden>
          <span
            className="priimo-dpe-age__fill"
            style={{ left: `${startPct}%`, width: `${spanPct}%` }}
          />
        </div>
        <input
          type="range"
          min={0}
          max={max}
          step={1}
          value={from}
          disabled={disabled}
          aria-label="Début de la plage d’ancienneté"
          aria-valuetext={DPE_AGE_LABELS[DPE_AGE_BUCKETS[from]]}
          className="priimo-dpe-age__input priimo-dpe-age__input--from"
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
          aria-label="Fin de la plage d’ancienneté"
          aria-valuetext={DPE_AGE_LABELS[DPE_AGE_BUCKETS[to]]}
          className="priimo-dpe-age__input priimo-dpe-age__input--to"
          onChange={(e) => {
            const next = Number(e.target.value);
            onChange(from, Math.max(next, from));
          }}
        />
      </div>
      <div className="mt-1 flex justify-between gap-0.5">
        {DPE_AGE_BUCKETS.map((bucket) => (
          <span key={bucket} className="min-w-0 flex-1 text-center text-[10px] leading-tight text-text-subtle">
            {DPE_AGE_TICK_LABELS[bucket]}
          </span>
        ))}
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
        className={`flex w-full ${row} items-center gap-3 rounded-xl ${pad} text-left transition-colors duration-fluid-subtle ease-in-out hover:bg-[#B4BAC4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
          folderOn ? 'bg-[#C2C8D1]' : 'bg-[#D4D8DF]'
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
                  <div className="mt-1">
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
