'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Layer, Marker, Source, type MapRef } from 'react-map-gl';
import type { MapLayerMouseEvent } from 'mapbox-gl';
import {
  IGN_PCI_SOURCE_ID,
  IGN_PCI_SOURCE_LAYER,
  IGN_PCI_VECTOR_SOURCE,
} from '@/lib/map/style';
import {
  PARCELLE_MIN_ZOOM,
  PARCELLE_SLATE,
  centroidLngLat,
  type ParcelleNoteMarker,
} from '@/lib/carte/parcelle';

export const PARCELLES_FILL_LAYER_ID = 'parcelles-fill';
export const PARCELLES_LINE_LAYER_ID = 'parcelles-line';

const FILL = 'rgba(61, 90, 128, 0.14)';
const LINE = 'rgba(61, 90, 128, 0.4)';

type Pin = { idu: string; longitude: number; latitude: number };

function iduOf(feature: { properties?: Record<string, unknown> | null } | undefined): string | null {
  const raw = feature?.properties?.idu;
  return typeof raw === 'string' ? raw : null;
}

function mapCanvas(map: { getCanvas: () => HTMLCanvasElement | undefined }): HTMLCanvasElement | null {
  try {
    return map.getCanvas() ?? null;
  } catch {
    return null;
  }
}

export default function ParcellesLayer({
  mapRef,
  enabled,
  eventIdus,
  noteMarkers,
  selectedIdu,
  onPick,
}: {
  mapRef: React.RefObject<MapRef | null>;
  enabled: boolean;
  eventIdus: readonly string[];
  noteMarkers: readonly ParcelleNoteMarker[];
  selectedIdu: string | null;
  onPick: (idu: string) => void;
}) {
  const hoverId = useRef<string | null>(null);
  const painted = useRef<Set<string>>(new Set());
  const eventSet = useRef(new Set<string>());
  eventSet.current = new Set(eventIdus);
  const [pins, setPins] = useState<Pin[]>([]);

  const noteByIdu = useMemo(() => {
    const map = new Map<string, ParcelleNoteMarker>();
    for (const m of noteMarkers) {
      if (!map.has(m.idu)) map.set(m.idu, m);
    }
    return map;
  }, [noteMarkers]);

  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !enabled) {
      setPins([]);
      return;
    }

    let cancelled = false;

    const paintStates = () => {
      if (cancelled) return;
      if (!map.getLayer(PARCELLES_FILL_LAYER_ID)) return;
      const canvas = mapCanvas(map);
      if (!canvas) return;
      const feats = map.queryRenderedFeatures(
        [
          [0, 0],
          [canvas.width, canvas.height],
        ],
        { layers: [PARCELLES_FILL_LAYER_ID] },
      );
      const next = new Set<string>();
      const nextPins: Pin[] = [];
      const pinSeen = new Set<string>();

      for (const f of feats) {
        const idu = iduOf(f);
        if (!idu) continue;
        next.add(idu);
        map.setFeatureState(
          { source: IGN_PCI_SOURCE_ID, sourceLayer: IGN_PCI_SOURCE_LAYER, id: idu },
          {
            active: eventSet.current.has(idu),
            selected: selectedIdu === idu,
            hover: hoverId.current === idu,
          },
        );
        if (noteByIdu.has(idu) && !pinSeen.has(idu)) {
          const c = centroidLngLat(f.geometry);
          if (c) {
            pinSeen.add(idu);
            nextPins.push({ idu, longitude: c.longitude, latitude: c.latitude });
          }
        }
      }

      for (const [idu, marker] of noteByIdu) {
        if (pinSeen.has(idu)) continue;
        if (marker.latitude == null || marker.longitude == null) continue;
        pinSeen.add(idu);
        nextPins.push({ idu, longitude: marker.longitude, latitude: marker.latitude });
      }

      for (const idu of painted.current) {
        if (next.has(idu)) continue;
        map.removeFeatureState({ source: IGN_PCI_SOURCE_ID, sourceLayer: IGN_PCI_SOURCE_LAYER, id: idu });
      }
      painted.current = next;
      if (cancelled) return;
      setPins((prev) => {
        const key = (rows: Pin[]) =>
          rows.map((p) => `${p.idu}:${p.longitude.toFixed(5)}:${p.latitude.toFixed(5)}`).join('|');
        return key(prev) === key(nextPins) ? prev : nextPins;
      });
    };

    const applyHover = (idu: string | null) => {
      const canvas = mapCanvas(map);
      if (canvas) canvas.style.cursor = idu ? 'pointer' : '';
      if (idu === hoverId.current) return;
      if (hoverId.current) {
        map.setFeatureState(
          { source: IGN_PCI_SOURCE_ID, sourceLayer: IGN_PCI_SOURCE_LAYER, id: hoverId.current },
          {
            active: eventSet.current.has(hoverId.current),
            selected: selectedIdu === hoverId.current,
            hover: false,
          },
        );
      }
      hoverId.current = idu;
      if (idu) {
        map.setFeatureState(
          { source: IGN_PCI_SOURCE_ID, sourceLayer: IGN_PCI_SOURCE_LAYER, id: idu },
          { active: eventSet.current.has(idu), selected: selectedIdu === idu, hover: true },
        );
      }
    };

    const onMove = (e: MapLayerMouseEvent) => {
      applyHover(iduOf(e.features?.[0]));
    };
    const onLeave = () => applyHover(null);
    const onClick = (e: MapLayerMouseEvent) => {
      const idu = iduOf(e.features?.[0]);
      if (!idu) return;
      e.originalEvent.stopPropagation();
      onPick(idu);
    };

    map.on('idle', paintStates);
    map.on('mousemove', PARCELLES_FILL_LAYER_ID, onMove);
    map.on('mouseleave', PARCELLES_FILL_LAYER_ID, onLeave);
    map.on('click', PARCELLES_FILL_LAYER_ID, onClick);
    paintStates();

    return () => {
      cancelled = true;
      map.off('idle', paintStates);
      map.off('mousemove', PARCELLES_FILL_LAYER_ID, onMove);
      map.off('mouseleave', PARCELLES_FILL_LAYER_ID, onLeave);
      map.off('click', PARCELLES_FILL_LAYER_ID, onClick);
      const canvas = mapCanvas(map);
      if (canvas) canvas.style.cursor = '';
    };
  }, [enabled, eventIdus, mapRef, noteByIdu, onPick, selectedIdu]);

  if (!enabled) return null;

  return (
    <>
      <Source id={IGN_PCI_SOURCE_ID} {...IGN_PCI_VECTOR_SOURCE}>
        <Layer
          id={PARCELLES_FILL_LAYER_ID}
          type="fill"
          source-layer={IGN_PCI_SOURCE_LAYER}
          minzoom={PARCELLE_MIN_ZOOM}
          paint={{
            'fill-color': [
              'case',
              ['boolean', ['feature-state', 'active'], false],
              FILL,
              'rgba(61, 90, 128, 0)',
            ],
            'fill-opacity': 1,
          }}
        />
        <Layer
          id={PARCELLES_LINE_LAYER_ID}
          type="line"
          source-layer={IGN_PCI_SOURCE_LAYER}
          minzoom={PARCELLE_MIN_ZOOM}
          paint={{
            'line-color': LINE,
            'line-width': [
              'case',
              ['boolean', ['feature-state', 'hover'], false],
              2.2,
              ['boolean', ['feature-state', 'selected'], false],
              1.8,
              0.8,
            ],
            'line-opacity': 1,
          }}
        />
      </Source>
      {pins.map((m) => (
        <Marker
          key={m.idu}
          longitude={m.longitude}
          latitude={m.latitude}
          anchor="center"
          style={{ zIndex: 4 }}
          onClick={(event) => {
            event.originalEvent.stopPropagation();
            onPick(m.idu);
          }}
        >
          <button
            type="button"
            className="priimo-pin priimo-pin--parcelle"
            aria-label={`Note sur la parcelle ${m.idu}`}
            style={{ background: PARCELLE_SLATE, color: '#fff' }}
          />
        </Marker>
      ))}
    </>
  );
}
