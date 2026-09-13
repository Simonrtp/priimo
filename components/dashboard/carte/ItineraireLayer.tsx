'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Layer, Marker, Source, useMap } from 'react-map-gl';
import type { ExpressionSpecification } from 'mapbox-gl';
import { Check } from 'lucide-react';
import type { ItineraireStop } from '@/lib/today/directions';
import { FIELD } from '@/lib/today/field';
import { lineGeoJson } from '@/lib/today/sortie';
import { simplifyLineString } from '@/lib/today/simplify-line';
import {
  projectOnLine,
  stopFraction,
  stopPixelOffsets,
  type TracePoint,
} from '@/lib/today/itineraire-trace';

const ARDOISE = FIELD.ardoise;
const ARDOISE_MUTE = 'rgba(108, 118, 132, 0.45)';
const HALO = 'rgba(255, 255, 255, 0.65)';
const TRACE_MS = 900;

const LINE_LAYOUT = { 'line-cap': 'round' as const, 'line-join': 'round' as const };

const LINE_WIDTH = ['interpolate', ['linear'], ['zoom'], 15, 4, 17, 5.5] as ExpressionSpecification;
const HALO_WIDTH = ['interpolate', ['linear'], ['zoom'], 15, 9, 17, 12] as ExpressionSpecification;

function geometryKey(line: GeoJSON.LineString): string {
  const c = line.coordinates;
  const a = c[0];
  const b = c[Math.floor(c.length / 2)];
  const d = c[c.length - 1];
  return `${c.length}:${a?.[0]},${a?.[1]}:${b?.[0]},${b?.[1]}:${d?.[0]},${d?.[1]}`;
}

function prefersReduce(): boolean {
  if (typeof window === 'undefined') return true;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function clipGradient(drawn: number, color: string, from = 0): ExpressionSpecification {
  const start = Math.max(0, Math.min(1, from));
  const end = Math.max(start, Math.min(1, drawn));
  const eps = 0.002;
  return [
    'interpolate',
    ['linear'],
    ['line-progress'],
    0,
    'rgba(0,0,0,0)',
    Math.max(0, start - eps),
    'rgba(0,0,0,0)',
    start,
    color,
    end,
    color,
    Math.min(1, end + eps),
    'rgba(0,0,0,0)',
  ] as ExpressionSpecification;
}

function ArretPin({
  index,
  state,
  address,
}: {
  index: number;
  state: 'upcoming' | 'current' | 'done';
  address: string;
}) {
  const label =
    state === 'done'
      ? `Arrêt ${index} fait : ${address}`
      : state === 'current'
        ? `Arrêt en cours ${index} : ${address}`
        : `Arrêt ${index} : ${address}`;
  return (
    <span
      className={`priimo-pin priimo-pin--arret${
        state === 'current' ? ' priimo-pin--arret-current' : state === 'done' ? ' priimo-pin--arret-done' : ''
      }`}
      aria-label={label}
    >
      {state === 'done' ? <Check size={11} strokeWidth={2.8} aria-hidden /> : index}
    </span>
  );
}

export default function ItineraireLayer({
  geometry,
  stops,
  onStop,
  showStops = true,
  currentLeadId = null,
  completedLeadIds,
  progressPoint = null,
}: {
  geometry: GeoJSON.LineString | null;
  stops: readonly ItineraireStop[];
  onStop?: (stop: ItineraireStop) => void;
  showStops?: boolean;
  currentLeadId?: string | null;
  completedLeadIds?: readonly string[];
  progressPoint?: TracePoint | null;
}) {
  const maps = useMap();
  const map = maps.current;
  const [zoom, setZoom] = useState(15);
  const [drawn, setDrawn] = useState(1);
  const animatedFor = useRef<string | null>(null);
  const done = useMemo(() => new Set(completedLeadIds ?? []), [completedLeadIds]);

  useEffect(() => {
    if (!map) return;
    const sync = () => setZoom(map.getZoom());
    sync();
    map.on('zoomend', sync);
    return () => {
      map.off('zoomend', sync);
    };
  }, [map]);

  const raw = useMemo<GeoJSON.LineString | null>(
    () => geometry ?? (stops.length >= 2 ? lineGeoJson(stops).geometry : null),
    [geometry, stops],
  );

  const simplified = useMemo(
    () => (raw ? simplifyLineString(raw, zoom) : null),
    [raw, zoom],
  );

  const key = raw ? geometryKey(raw) : '';

  useEffect(() => {
    if (!key) return;
    if (animatedFor.current === key) return;
    animatedFor.current = key;
    if (prefersReduce()) {
      setDrawn(1);
      return;
    }
    setDrawn(0);
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / TRACE_MS);
      const eased = 1 - (1 - t) * (1 - t);
      setDrawn(eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [key]);

  const coords = simplified?.coordinates ?? [];
  const traveledFrac = useMemo(() => {
    if (!progressPoint || coords.length < 2) return 0;
    return projectOnLine(coords as [number, number][], progressPoint)?.fraction ?? 0;
  }, [progressPoint, coords]);

  const inferredCurrent = useMemo(() => {
    if (currentLeadId || !progressPoint || coords.length < 2) return currentLeadId;
    let best: ItineraireStop | null = null;
    let bestFrac = Infinity;
    for (const stop of stops) {
      if (done.has(stop.leadId)) continue;
      const frac = stopFraction(coords as [number, number][], stop);
      if (frac + 0.02 >= traveledFrac && frac < bestFrac) {
        bestFrac = frac;
        best = stop;
      }
    }
    return best?.leadId ?? currentLeadId;
  }, [currentLeadId, progressPoint, coords, stops, done, traveledFrac]);

  const offsets = useMemo(
    () => stopPixelOffsets(stops, zoom, 24),
    [stops, zoom],
  );

  if (stops.length < 2 && !geometry) return null;
  if (!simplified) return null;

  const feature: GeoJSON.Feature<GeoJSON.LineString> = {
    type: 'Feature',
    properties: {},
    geometry: simplified,
  };

  return (
    <>
      <Source id="priimo-itineraire" type="geojson" data={feature} lineMetrics>
        <Layer
          id="priimo-itineraire-halo"
          type="line"
          layout={LINE_LAYOUT}
          paint={{
            'line-width': HALO_WIDTH,
            'line-gradient': clipGradient(drawn, HALO),
          }}
        />
        <Layer
          id="priimo-itineraire-done"
          type="line"
          layout={LINE_LAYOUT}
          paint={{
            'line-width': LINE_WIDTH,
            'line-gradient': clipGradient(Math.min(drawn, traveledFrac), ARDOISE_MUTE, 0),
          }}
        />
        <Layer
          id="priimo-itineraire-line"
          type="line"
          layout={LINE_LAYOUT}
          paint={{
            'line-width': LINE_WIDTH,
            'line-gradient': clipGradient(drawn, ARDOISE, traveledFrac),
          }}
        />
      </Source>
      {showStops
        ? stops.map((stop, i) => {
            const frac = coords.length >= 2 ? stopFraction(coords as [number, number][], stop) : i / Math.max(1, stops.length - 1);
            if (drawn < frac - 0.03) return null;
            const state: 'upcoming' | 'current' | 'done' = done.has(stop.leadId)
              ? 'done'
              : stop.leadId === inferredCurrent
                ? 'current'
                : 'upcoming';
            const offset = offsets[i] ?? ([0, 0] as [number, number]);
            return (
              <Marker
                key={stop.leadId}
                longitude={stop.longitude}
                latitude={stop.latitude}
                anchor="center"
                offset={offset}
                style={{ zIndex: state === 'current' ? 36 : state === 'done' ? 22 : 30 }}
              >
                {onStop ? (
                  <button
                    type="button"
                    className="cursor-pointer bg-transparent p-0"
                    onClick={(event) => {
                      event.stopPropagation();
                      onStop(stop);
                    }}
                  >
                    <ArretPin index={i + 1} state={state} address={stop.address} />
                  </button>
                ) : (
                  <ArretPin index={i + 1} state={state} address={stop.address} />
                )}
              </Marker>
            );
          })
        : null}
    </>
  );
}

export { ArretPin };
export type { TracePoint };
