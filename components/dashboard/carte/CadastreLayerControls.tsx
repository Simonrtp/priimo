'use client';

import { ChevronDown } from 'lucide-react';
import {
  CADASTRE_LAYER_IDS,
  CADASTRE_LAYER_LABELS,
  anyCadastreLayer,
  type CadastreLayerId,
  type MapLayerState,
} from '@/lib/carte/layers';
import { DPE_AGE_BUCKETS, DPE_AGE_LABELS, type DpeAgeBucket } from '@/lib/carte/dpe-age';
import { CADASTRE_OVERLAY_MIN_ZOOM, PARCELLE_MIN_ZOOM } from '@/lib/carte/parcelle';
import {
  formatCadastreFreshness,
  type CadastreSourceDates,
} from '@/lib/carte/cadastre-freshness';

const SLATE = '#3D5A80';

function layerKey(id: CadastreLayerId): keyof Pick<
  MapLayerState,
  'cadastre' | 'cadastreDpe' | 'cadastreVentes' | 'cadastreCopro'
> {
  if (id === 'parcelles') return 'cadastre';
  if (id === 'dpe') return 'cadastreDpe';
  if (id === 'ventes') return 'cadastreVentes';
  return 'cadastreCopro';
}

export default function CadastreLayerControls({
  layers,
  onToggleOverlay,
  onToggleDpeAge,
  onToggleMenu,
  mapZoom,
  sources = null,
  compact = false,
}: {
  layers: MapLayerState;
  onToggleOverlay: (id: CadastreLayerId) => void;
  onToggleDpeAge: (bucket: DpeAgeBucket) => void;
  onToggleMenu: () => void;
  mapZoom: number | null;
  sources?: CadastreSourceDates | null;
  compact?: boolean;
}) {
  const open = layers.cadastreMenuOpen;
  const tooFarPolygons = mapZoom !== null && mapZoom < PARCELLE_MIN_ZOOM;
  const tooFarPoints = mapZoom !== null && mapZoom < CADASTRE_OVERLAY_MIN_ZOOM;
  const row = compact ? 'min-h-[44px]' : 'min-h-[40px]';
  const pad = compact ? 'px-1' : 'px-2.5 py-1.5';
  const folderOn = anyCadastreLayer(layers);
  const freshness = sources ? formatCadastreFreshness(sources) : null;

  return (
    <li>
      <button
        type="button"
        aria-expanded={open}
        aria-label={open ? 'Replier Cadastre' : 'Déplier Cadastre'}
        onClick={onToggleMenu}
        className={`flex w-full ${row} items-center gap-3 rounded-xl ${pad} text-left transition-colors duration-fluid-subtle ease-in-out hover:bg-black/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
          folderOn ? 'bg-black/[0.04]' : ''
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
          {CADASTRE_LAYER_IDS.map((id) => {
            const key = layerKey(id);
            const active = layers[key];
            const tooFar = id === 'parcelles' ? tooFarPolygons : tooFarPoints;
            return (
              <li key={id}>
                <label
                  className={`flex ${row} cursor-pointer items-center gap-3 rounded-xl ${pad} transition-colors duration-fluid-subtle ease-in-out ${
                    tooFar ? 'opacity-55' : ''
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
                      active && !tooFar ? 'text-text-strong' : 'text-text-muted'
                    }`}
                  >
                    {CADASTRE_LAYER_LABELS[id]}
                    {tooFar ? (
                      <span className="mt-0.5 block text-[11.5px] font-normal text-text-subtle">
                        Zoomez pour afficher
                      </span>
                    ) : null}
                    {id === 'parcelles' ? (
                      <span className="mt-0.5 block text-[11.5px] font-normal text-text-subtle">
                        Plan cadastral indicatif, sans valeur juridique
                      </span>
                    ) : null}
                  </span>
                </label>
                {id === 'dpe' ? (
                  <div
                    role="group"
                    aria-label="Ancienneté des diagnostics"
                    className={`pb-2 ${compact ? 'pl-8' : 'pl-7'} ${
                      layers.cadastreDpe ? '' : 'opacity-55'
                    }`}
                  >
                    <div className="mt-1 h-1 rounded-full bg-black/[0.08]" aria-hidden />
                    <div className="mt-2 flex flex-wrap gap-1">
                      {DPE_AGE_BUCKETS.map((bucket) => {
                        const selected = layers.cadastreDpeAges.includes(bucket);
                        return (
                          <button
                            key={bucket}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => onToggleDpeAge(bucket)}
                            className={`rounded-full px-2 py-1 text-left text-[11px] font-medium leading-tight transition-colors duration-fluid-subtle ease-in-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                              selected
                                ? 'text-white'
                                : 'bg-black/[0.04] text-text-muted hover:bg-black/[0.07]'
                            }`}
                            style={selected ? { backgroundColor: SLATE } : undefined}
                          >
                            {DPE_AGE_LABELS[bucket]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
        {freshness ? (
          <p className="mt-2 px-1 text-[11px] leading-snug text-text-subtle">{freshness}</p>
        ) : null}
      </div>
    </li>
  );
}
