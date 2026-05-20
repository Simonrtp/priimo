'use client';

import { useCallback, useId, useState } from 'react';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import ZoneRadiusMap from '@/components/ZoneRadiusMap';
import type { SelectedAddress } from '@/lib/ban';
import {
  PARIS_ARRONDISSEMENT_MAX,
  PARIS_ARRONDISSEMENTS,
} from '@/lib/paris-arrondissements';
import {
  ZONE_RADIUS_KM_MAX,
  ZONE_RADIUS_KM_MIN,
  ZONE_RADIUS_KM_STEP,
  clampZoneRadiusKm,
} from '@/lib/zone-config';
import type { ZoneValue } from '@/types/zone';

interface ZoneSelectorProps {
  value: ZoneValue;
  onChange: (value: ZoneValue) => void;
  /** Message d'erreur externe (ex. validation submit). */
  error?: string | null;
  addressInputClassName?: string;
}

const labelClass = 'block text-sm font-medium tracking-wide mb-1.5 text-gray-900';
const defaultInputClass =
  'w-full rounded-xl border bg-white border-black/10 text-gray-900 placeholder-gray-500/70 px-4 py-3 text-base outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15';

export default function ZoneSelector({
  value,
  onChange,
  error = null,
  addressInputClassName = `${defaultInputClass} pl-10 pr-10`,
}: ZoneSelectorProps) {
  const tabsId = useId();
  const [localError, setLocalError] = useState<string | null>(null);
  const mode = value.type;

  const setMode = useCallback(
    (next: 'radius' | 'postal_codes') => {
      setLocalError(null);
      if (next === mode) return;
      if (next === 'radius') {
        onChange({
          type: 'radius',
          address: value.type === 'radius' ? value.address : '',
          latitude: value.type === 'radius' ? value.latitude : 0,
          longitude: value.type === 'radius' ? value.longitude : 0,
          radius_km: value.type === 'radius' ? value.radius_km : 2,
        });
      } else {
        onChange({
          type: 'postal_codes',
          codes: value.type === 'postal_codes' ? value.codes : [],
        });
      }
    },
    [mode, onChange, value],
  );

  const toggleArrondissement = (code: string) => {
    setLocalError(null);
    if (value.type !== 'postal_codes') return;
    const selected = value.codes.includes(code);
    const next = selected ? value.codes.filter((c) => c !== code) : [...value.codes, code];
    if (next.length > PARIS_ARRONDISSEMENT_MAX) {
      setLocalError(`Maximum ${PARIS_ARRONDISSEMENT_MAX} arrondissements.`);
      return;
    }
    onChange({ type: 'postal_codes', codes: next.sort() });
  };

  const displayError = error ?? localError;
  const radiusValid =
    value.type === 'radius' &&
    value.address.trim().length >= 5 &&
    !(value.latitude === 0 && value.longitude === 0);

  return (
    <div className="space-y-5">
      <div
        role="tablist"
        aria-labelledby={tabsId}
        className="inline-flex w-full rounded-xl bg-black/[0.05] p-1 sm:w-auto"
      >
        <span id={tabsId} className="sr-only">
          Mode de zone
        </span>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'radius'}
          onClick={() => setMode('radius')}
          className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors sm:flex-none sm:min-w-[140px] ${
            mode === 'radius' ? 'bg-white text-ink shadow-sm' : 'text-mute hover:text-ink'
          }`}
        >
          Par rayon
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'postal_codes'}
          onClick={() => setMode('postal_codes')}
          className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors sm:flex-none sm:min-w-[160px] ${
            mode === 'postal_codes' ? 'bg-white text-ink shadow-sm' : 'text-mute hover:text-ink'
          }`}
        >
          Par arrondissements
        </button>
      </div>

      {mode === 'radius' ? (
        <div role="tabpanel" className="space-y-5">
          <p className="text-sm leading-relaxed text-mute">
            Idéal en province ou hors Paris : centre sur une adresse et un rayon autour.
          </p>

          <div>
            <label htmlFor="zone-radius-address" className={labelClass}>
              Adresse du centre de votre zone
            </label>
            <AddressAutocomplete
              id="zone-radius-address"
              value={value.address}
              onChange={(addr) => {
                setLocalError(null);
                if (!addr) {
                  onChange({
                    type: 'radius',
                    address: '',
                    latitude: 0,
                    longitude: 0,
                    radius_km: value.radius_km,
                  });
                  return;
                }
                onChange({
                  type: 'radius',
                  address: addr.label,
                  latitude: addr.latitude,
                  longitude: addr.longitude,
                  radius_km: value.radius_km,
                });
              }}
              placeholder="Ex : 5 rue Esquirol, 75013 Paris"
              required
              inputClassName={addressInputClassName}
            />
            {radiusValid && (
              <p className="mt-2 flex items-center gap-1 text-sm text-green-700">
                <span aria-hidden>✓</span>
                Adresse validée
              </p>
            )}
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <label htmlFor="zone-radius-km" className={labelClass}>
                Rayon de prospection
              </label>
              <span className="text-sm font-semibold tabular-nums text-accent-dark">
                {value.radius_km % 1 === 0 ? value.radius_km : value.radius_km.toFixed(1)} km
              </span>
            </div>
            <input
              id="zone-radius-km"
              type="range"
              min={ZONE_RADIUS_KM_MIN}
              max={ZONE_RADIUS_KM_MAX}
              step={ZONE_RADIUS_KM_STEP}
              value={value.radius_km}
              onChange={(e) => {
                setLocalError(null);
                onChange({
                  ...value,
                  radius_km: clampZoneRadiusKm(Number(e.target.value)),
                });
              }}
              className="w-full accent-accent"
            />
            <div className="mt-1 flex justify-between text-xs text-mute tabular-nums">
              <span>{ZONE_RADIUS_KM_MIN} km</span>
              <span>{ZONE_RADIUS_KM_MAX / 2} km</span>
              <span>{ZONE_RADIUS_KM_MAX} km</span>
            </div>
          </div>

          {radiusValid && (
            <ZoneRadiusMap
              latitude={value.latitude}
              longitude={value.longitude}
              radiusKm={value.radius_km}
            />
          )}
        </div>
      ) : (
        <div role="tabpanel" className="space-y-4">
          <p className="text-sm leading-relaxed text-mute">
            <span className="font-medium text-ink">Pour Paris uniquement.</span> Sélectionnez un ou
            plusieurs arrondissements (75001 à 75020). En province, utilisez le mode{' '}
            <span className="font-medium text-ink">Par rayon</span>.
          </p>

          <div
            className="grid grid-cols-4 gap-2 sm:grid-cols-5"
            role="group"
            aria-label="Arrondissements de Paris"
          >
            {PARIS_ARRONDISSEMENTS.map((arr) => {
              const selected =
                value.type === 'postal_codes' && value.codes.includes(arr.code);
              return (
                <button
                  key={arr.code}
                  type="button"
                  aria-pressed={selected}
                  aria-label={`${arr.label}${selected ? ', sélectionné' : ''}`}
                  onClick={() => toggleArrondissement(arr.code)}
                  className={`flex flex-col items-center justify-center rounded-xl px-1 py-2.5 text-center transition-colors duration-150 ${
                    selected
                      ? 'bg-[#f97316] text-white shadow-sm'
                      : 'bg-black/[0.06] text-ink hover:bg-black/[0.1]'
                  }`}
                >
                  <span className="text-sm font-bold leading-none">{arr.shortLabel}</span>
                  <span
                    className={`mt-1 text-[10px] tabular-nums leading-none ${
                      selected ? 'text-white/90' : 'text-mute'
                    }`}
                  >
                    {arr.code}
                  </span>
                </button>
              );
            })}
          </div>

          <p className="text-sm font-medium text-ink">
            {value.type === 'postal_codes' && value.codes.length > 0 ? (
              <>
                <span className="tabular-nums text-accent-dark">{value.codes.length}</span>{' '}
                arrondissement{value.codes.length > 1 ? 's' : ''} sélectionné
                {value.codes.length > 1 ? 's' : ''}
                <span className="mt-1 block text-xs font-normal text-mute">
                  {value.codes.join(', ')}
                </span>
              </>
            ) : (
              <span className="text-mute">Aucun arrondissement sélectionné</span>
            )}
          </p>
        </div>
      )}

      {displayError && (
        <p className="text-sm text-red-600" role="alert">
          {displayError}
        </p>
      )}
    </div>
  );
}
