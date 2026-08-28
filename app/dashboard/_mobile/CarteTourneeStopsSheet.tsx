'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, Flame, Loader2, MapPin, Plus, Route, X } from 'lucide-react';
import AddressAutocomplete, { type SelectedAddress } from '@/components/AddressAutocomplete';
import type { SortieStop } from '@/lib/today/sortie';
import { MAX_SORTIE_STOPS } from '@/lib/today/sortie';
import { estimateWalkCalories, estimateWalkDurationS } from '@/lib/today/sortie-session';
import { formatWalkingDuration } from '@/lib/today/directions';
import { FIELD, formatDistance } from '@/lib/today/field';
import { armPointerShield } from '@/lib/ui/pointer-guard';

/**
 * Déroulant de tournée : la carte reste celle de tous les jours, ce panneau
 * sert seulement à voir et retoucher les adresses du chemin tracé.
 */
export default function CarteTourneeStopsSheet({
  stops,
  distanceM,
  durationS,
  optimizing,
  picking,
  postcodeFilter,
  onRemove,
  onAddAddress,
  onPickOnMap,
  onStop,
  onFocusStop,
}: {
  stops: readonly SortieStop[];
  distanceM: number;
  durationS: number | null;
  optimizing: boolean;
  /** Mode « choisir un point » actif : le panneau s'efface pour dégager la carte. */
  picking: boolean;
  postcodeFilter?: string;
  onRemove: (key: string) => void;
  onAddAddress: (address: SelectedAddress) => void;
  onPickOnMap: () => void;
  onStop: () => void;
  onFocusStop: (stop: SortieStop) => void;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (picking) setOpen(false);
  }, [picking]);

  const duration = durationS ?? estimateWalkDurationS(distanceM);
  const calories = estimateWalkCalories(distanceM, duration);
  const full = stops.length >= MAX_SORTIE_STOPS;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[70] px-3">
      <div
        className="pointer-events-auto overflow-hidden rounded-[24px] bg-surface shadow-[0_-10px_36px_rgba(15,23,34,0.2)] ring-1 ring-black/[0.06]"
        style={{ marginBottom: 'calc(10px + var(--field-nav-height))' }}
      >
        <div className="flex items-center gap-2 px-3 py-2.5">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="app-press flex min-h-[48px] min-w-0 flex-1 items-center gap-2.5 rounded-2xl px-1.5 text-left"
          >
            <span
              className="flex size-9 flex-shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: FIELD.orangePastel, color: FIELD.orange }}
              aria-hidden
            >
              {optimizing ? (
                <Loader2 size={17} strokeWidth={2.3} className="animate-spin" />
              ) : (
                <Route size={17} strokeWidth={2.3} />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-semibold text-text-strong">
                {stops.length} adresse{stops.length > 1 ? 's' : ''} à prospecter
              </span>
              <span className="flex items-center gap-2 text-[12.5px] text-text-muted">
                {optimizing ? (
                  'Calcul du meilleur chemin…'
                ) : (
                  <>
                    <span className="tabular-nums">{formatDistance(distanceM)}</span>
                    <span aria-hidden>·</span>
                    <span className="tabular-nums">{formatWalkingDuration(duration)}</span>
                    <span aria-hidden>·</span>
                    <span className="flex items-center gap-1 tabular-nums">
                      <Flame size={11} strokeWidth={2.4} aria-hidden />
                      {calories} kcal
                    </span>
                  </>
                )}
              </span>
            </span>
            <ChevronDown
              size={20}
              strokeWidth={2.2}
              aria-hidden
              className={`flex-shrink-0 text-text-muted transition-transform duration-200 ${
                open ? '' : 'rotate-180'
              }`}
            />
          </button>
          <button
            type="button"
            onClick={() => {
              armPointerShield();
              onStop();
            }}
            aria-label="Arrêter la tournée"
            className="app-press flex size-11 flex-shrink-0 items-center justify-center rounded-full bg-black/[0.05] text-text-muted"
          >
            <X size={19} strokeWidth={2.2} aria-hidden />
          </button>
        </div>

        {open ? (
          <div className="border-t border-black/[0.06]">
            <div className="max-h-[min(46dvh,380px)] overflow-y-auto overscroll-contain px-3 pb-3 pt-2">
              <ol className="flex flex-col gap-0.5">
                {stops.map((stop, index) => (
                  <li key={stop.key} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onFocusStop(stop)}
                      className="app-press flex min-h-[52px] min-w-0 flex-1 items-center gap-3 rounded-2xl px-1.5 text-left"
                    >
                      <span
                        className="flex size-7 flex-shrink-0 items-center justify-center rounded-full text-[12.5px] font-semibold tabular-nums text-white"
                        style={{ backgroundColor: FIELD.orange }}
                        aria-hidden
                      >
                        {index + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14.5px] font-medium text-text-strong">
                          {stop.address}
                        </span>
                        {stop.mainSignalLabel ? (
                          <span className="block truncate text-[12px] text-text-muted">
                            {stop.mainSignalLabel}
                          </span>
                        ) : null}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemove(stop.key)}
                      aria-label={`Retirer ${stop.address} de la tournée`}
                      className="app-press flex size-10 flex-shrink-0 items-center justify-center rounded-full text-text-subtle"
                    >
                      <X size={17} strokeWidth={2.2} aria-hidden />
                    </button>
                  </li>
                ))}
              </ol>

              <div className="mt-3 border-t border-black/[0.06] pt-3">
                <p className="flex items-center gap-1.5 px-1.5 pb-2 text-[12px] font-semibold uppercase tracking-wide text-text-muted">
                  <Plus size={13} strokeWidth={2.4} aria-hidden />
                  Ajouter une adresse
                </p>
                {full ? (
                  <p className="px-1.5 text-[13px] text-text-muted">
                    Tournée complète — {MAX_SORTIE_STOPS} adresses. Retirez-en une pour en ajouter
                    une autre.
                  </p>
                ) : (
                  <>
                    <div className="px-0.5">
                      <AddressAutocomplete
                        placeholder="Rechercher une adresse…"
                        postcodeFilter={postcodeFilter}
                        onChange={(data) => {
                          if (data) onAddAddress(data);
                        }}
                        inputClassName="w-full rounded-xl border border-black/[0.08] bg-black/[0.02] py-3 pl-10 pr-3 text-[15px] text-text-strong outline-none focus:border-accent"
                        aria-label="Rechercher une adresse à ajouter à la tournée"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={onPickOnMap}
                      className="app-press mt-2 flex min-h-[48px] w-full items-center gap-2 rounded-xl px-1.5 text-left text-[14px] font-semibold"
                      style={{ color: FIELD.orange }}
                    >
                      <MapPin size={16} strokeWidth={2.4} aria-hidden />
                      Ou choisir un point sur la carte
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
