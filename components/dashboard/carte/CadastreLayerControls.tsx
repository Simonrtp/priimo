'use client';

import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  CADASTRE_LAYER_IDS,
  CADASTRE_LAYER_LABELS,
  persistCadastreMenuOpen,
  readCadastreMenuOpen,
  type CadastreLayerId,
  type MapLayerState,
} from '@/lib/carte/layers';
import { CADASTRE_OVERLAY_MIN_ZOOM, PARCELLE_MIN_ZOOM } from '@/lib/carte/parcelle';

const SLATE = '#3D5A80';

export default function CadastreLayerControls({
  layers,
  onToggleCadastre,
  onToggleOverlay,
  mapZoom,
  compact = false,
}: {
  layers: MapLayerState;
  onToggleCadastre: () => void;
  onToggleOverlay: (id: CadastreLayerId) => void;
  mapZoom: number | null;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    setOpen(readCadastreMenuOpen());
  }, []);

  function toggleMenu() {
    setOpen((prev) => {
      const next = !prev;
      persistCadastreMenuOpen(next);
      return next;
    });
  }

  const tooFarPolygons = mapZoom !== null && mapZoom < PARCELLE_MIN_ZOOM;
  const tooFarPoints = mapZoom !== null && mapZoom < CADASTRE_OVERLAY_MIN_ZOOM;
  const row = compact ? 'min-h-[44px]' : 'min-h-[40px]';
  const pad = compact ? 'px-1' : 'px-2.5 py-1.5';

  return (
    <li>
      <div
        className={`flex ${row} items-center gap-3 rounded-xl ${pad} transition-colors duration-fluid-subtle ease-in-out ${
          layers.cadastre ? 'bg-black/[0.04]' : ''
        } ${tooFarPolygons ? 'opacity-55' : ''}`}
      >
        <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            className="size-4 rounded border-black/20"
            style={{ accentColor: SLATE }}
            checked={layers.cadastre}
            onChange={onToggleCadastre}
          />
          <span
            className={`min-w-0 flex-1 text-[13.5px] font-medium ${
              layers.cadastre && !tooFarPolygons ? 'text-text-strong' : 'text-text-muted'
            }`}
          >
            Cadastre
            {tooFarPolygons ? (
              <span className="mt-0.5 block text-[11.5px] font-normal text-text-subtle">
                Zoomez pour afficher
              </span>
            ) : null}
          </span>
        </label>
        <button
          type="button"
          aria-expanded={open}
          aria-label={open ? 'Replier Cadastre' : 'Déplier Cadastre'}
          onClick={toggleMenu}
          className="flex size-8 items-center justify-center rounded-lg text-text-subtle transition-colors duration-fluid-subtle ease-in-out hover:bg-black/[0.05] hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <ChevronDown
            size={16}
            strokeWidth={2}
            aria-hidden
            className={`transition-transform duration-fluid-subtle ease-in-out ${open ? 'rotate-180' : ''}`}
          />
        </button>
      </div>
      <div
        className={`fluid-collapse ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
        aria-hidden={!open}
      >
        <ul className="mt-1 flex flex-col gap-0.5 pl-7">
          {CADASTRE_LAYER_IDS.map((id) => {
            const key =
              id === 'dpe' ? 'cadastreDpe' : id === 'ventes' ? 'cadastreVentes' : 'cadastreCopro';
            const active = layers[key];
            return (
              <li key={id}>
                <label
                  className={`flex ${row} cursor-pointer items-center gap-3 rounded-xl ${pad} transition-colors duration-fluid-subtle ease-in-out ${
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
              </li>
            );
          })}
        </ul>
      </div>
    </li>
  );
}
