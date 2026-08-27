'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Layer, Marker, Popup, Source, type MapRef } from 'react-map-gl';
import type { ExpressionSpecification, MapLayerMouseEvent } from 'mapbox-gl';
import {
  IGN_PCI_SOURCE_ID,
  IGN_PCI_SOURCE_LAYER,
  IGN_PCI_VECTOR_SOURCE,
} from '@/lib/map/style';
import { normalizeParcelleId } from '@/lib/carte/parcelle-id';
import { DPE_PALETTE } from '@/lib/carte/dpe-public';
import {
  COPRO_FILL,
  COPRO_PROCEDURE_FILL,
  PARCELLE_MIN_ZOOM,
  PARCELLE_SLATE,
  VENTE_FILL,
  centroidLngLat,
  type CadastreImmeublePoint,
  type ParcelleNoteMarker,
} from '@/lib/carte/parcelle';
import type { CadastreLayerId, MapLayerState } from '@/lib/carte/layers';
import { hoverPreviewFromCadastre, type HoverPreview } from '@/lib/carte/hover-preview';
import MapHoverBubble from '@/components/dashboard/carte/MapHoverBubble';

export const PARCELLES_FILL_LAYER_ID = 'parcelles-fill';
export const PARCELLES_LINE_LAYER_ID = 'parcelles-line';
export const CADASTRE_POINTS_SOURCE_ID = 'cadastre-immeubles';
export const CADASTRE_DPE_LAYER_ID = 'cadastre-dpe';
export const CADASTRE_DPE_LABEL_LAYER_ID = 'cadastre-dpe-label';
export const CADASTRE_VENTES_LAYER_ID = 'cadastre-ventes';
export const CADASTRE_COPRO_LAYER_ID = 'cadastre-copro';

const FILL = 'rgba(61, 90, 128, 0.14)';
const LINE = 'rgba(61, 90, 128, 0.4)';
const DPE_LETTER_FILTER: ExpressionSpecification = [
  'in',
  ['get', 'etiquette'],
  ['literal', ['A', 'B', 'C', 'D', 'E', 'F', 'G']],
];
const DPE_DOT_RADIUS: ExpressionSpecification = [
  'interpolate',
  ['linear'],
  ['zoom'],
  14,
  4,
  16,
  5.5,
  18,
  7,
];

type Pin = { parcelleId: string; longitude: number; latitude: number };
type OverlayHover = { lng: number; lat: number; preview: HoverPreview };

function overlayLayerOf(layerId: string | undefined): CadastreLayerId | null {
  if (layerId === CADASTRE_DPE_LAYER_ID || layerId === CADASTRE_DPE_LABEL_LAYER_ID) return 'dpe';
  if (layerId === CADASTRE_VENTES_LAYER_ID) return 'ventes';
  if (layerId === CADASTRE_COPRO_LAYER_ID) return 'copro';
  return null;
}

function pointerCanHover(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches;
}

function parcelleIdOf(feature: { properties?: Record<string, unknown> | null } | undefined): string | null {
  return normalizeParcelleId(typeof feature?.properties?.idu === 'string' ? feature.properties.idu : null);
}

function mapCanvas(map: { getCanvas: () => HTMLCanvasElement | undefined }): HTMLCanvasElement | null {
  try {
    return map.getCanvas() ?? null;
  } catch {
    return null;
  }
}

function priceLabel(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return '';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',')} M€`;
  if (n >= 10_000) return `${Math.round(n / 1000)} k€`;
  return `${Math.round(n)} €`;
}

export default function ParcellesLayer({
  mapRef,
  enabled,
  activeParcelleIds,
  noteMarkers,
  selectedParcelleId,
  immeubles,
  layers,
  onPick,
}: {
  mapRef: React.RefObject<MapRef | null>;
  enabled: boolean;
  activeParcelleIds: readonly string[];
  noteMarkers: readonly ParcelleNoteMarker[];
  selectedParcelleId: string | null;
  immeubles: readonly CadastreImmeublePoint[];
  layers: Pick<MapLayerState, 'cadastreDpe' | 'cadastreVentes' | 'cadastreCopro'>;
  onPick: (parcelleId: string) => void;
}) {
  const hoverId = useRef<string | null>(null);
  const painted = useRef<Set<string>>(new Set());
  const eventSet = useRef(new Set<string>());
  eventSet.current = new Set(activeParcelleIds);
  const immeublesRef = useRef(immeubles);
  immeublesRef.current = immeubles;
  const selectedParcelleRef = useRef(selectedParcelleId);
  selectedParcelleRef.current = selectedParcelleId;
  const [pins, setPins] = useState<Pin[]>([]);
  const [overlayHover, setOverlayHover] = useState<OverlayHover | null>(null);

  const noteByParcelle = useMemo(() => {
    const map = new Map<string, ParcelleNoteMarker>();
    for (const m of noteMarkers) {
      if (!map.has(m.parcelleId)) map.set(m.parcelleId, m);
    }
    return map;
  }, [noteMarkers]);

  const overlayGeojson = useMemo<GeoJSON.FeatureCollection>(() => {
    const features: GeoJSON.Feature[] = [];
    for (const row of immeubles) {
      const letter = (row.etiquetteDpe ?? '').trim().toUpperCase();
      const hasDpe = /^[A-G]$/.test(letter);
      const hasVente = row.nbTransactions > 0;
      const hasCopro = row.nbLots != null || row.procedureCopro;
      if (!hasDpe && !hasVente && !hasCopro) continue;
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [row.longitude, row.latitude] },
        properties: {
          banId: row.banId,
          parcelleId: row.parcelleId,
          etiquette: hasDpe ? letter : '',
          hasVente: hasVente ? '1' : '0',
          hasCopro: hasCopro ? '1' : '0',
          procedure: row.procedureCopro ? '1' : '0',
          prix: priceLabel(row.dernierPrix),
        },
      });
    }
    return { type: 'FeatureCollection', features };
  }, [immeubles]);

  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !enabled) {
      setPins([]);
      setOverlayHover(null);
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
        const parcelleId = parcelleIdOf(f);
        if (!parcelleId) continue;
        next.add(parcelleId);
        map.setFeatureState(
          { source: IGN_PCI_SOURCE_ID, sourceLayer: IGN_PCI_SOURCE_LAYER, id: f.id ?? parcelleId },
          {
            active: eventSet.current.has(parcelleId),
            selected: selectedParcelleId === parcelleId,
            hover: hoverId.current === parcelleId,
          },
        );
        if (noteByParcelle.has(parcelleId) && !pinSeen.has(parcelleId)) {
          const c = centroidLngLat(f.geometry);
          if (c) {
            pinSeen.add(parcelleId);
            nextPins.push({ parcelleId, longitude: c.longitude, latitude: c.latitude });
          }
        }
      }

      for (const [parcelleId, marker] of noteByParcelle) {
        if (pinSeen.has(parcelleId)) continue;
        if (marker.latitude == null || marker.longitude == null) continue;
        pinSeen.add(parcelleId);
        nextPins.push({ parcelleId, longitude: marker.longitude, latitude: marker.latitude });
      }

      for (const parcelleId of painted.current) {
        if (next.has(parcelleId)) continue;
        map.removeFeatureState({ source: IGN_PCI_SOURCE_ID, sourceLayer: IGN_PCI_SOURCE_LAYER, id: parcelleId });
      }
      painted.current = next;
      if (cancelled) return;
      setPins((prev) => {
        const key = (rows: Pin[]) =>
          rows.map((p) => `${p.parcelleId}:${p.longitude.toFixed(5)}:${p.latitude.toFixed(5)}`).join('|');
        return key(prev) === key(nextPins) ? prev : nextPins;
      });
    };

    const applyHover = (parcelleId: string | null) => {
      const canvas = mapCanvas(map);
      if (canvas) canvas.style.cursor = parcelleId ? 'pointer' : '';
      if (parcelleId === hoverId.current) return;
      if (hoverId.current) {
        map.setFeatureState(
          { source: IGN_PCI_SOURCE_ID, sourceLayer: IGN_PCI_SOURCE_LAYER, id: hoverId.current },
          {
            active: eventSet.current.has(hoverId.current),
            selected: selectedParcelleId === hoverId.current,
            hover: false,
          },
        );
      }
      hoverId.current = parcelleId;
      if (parcelleId) {
        map.setFeatureState(
          { source: IGN_PCI_SOURCE_ID, sourceLayer: IGN_PCI_SOURCE_LAYER, id: parcelleId },
          { active: eventSet.current.has(parcelleId), selected: selectedParcelleId === parcelleId, hover: true },
        );
      }
    };

    const onMove = (e: MapLayerMouseEvent) => {
      applyHover(parcelleIdOf(e.features?.[0]));
    };
    const onLeave = () => applyHover(null);
    const onClick = (e: MapLayerMouseEvent) => {
      const parcelleId = parcelleIdOf(e.features?.[0]);
      if (!parcelleId) return;
      e.originalEvent.stopPropagation();
      onPick(parcelleId);
    };

    const onOverlayMove = (e: MapLayerMouseEvent) => {
      if (!pointerCanHover()) return;
      const f = e.features?.[0];
      const layer = overlayLayerOf(f?.layer?.id);
      const banId = typeof f?.properties?.banId === 'string' ? f.properties.banId : null;
      const row = banId ? immeublesRef.current.find((item) => item.banId === banId) : undefined;
      if (!layer || !row) {
        setOverlayHover(null);
        return;
      }
      if (row.parcelleId && row.parcelleId === selectedParcelleRef.current) {
        setOverlayHover(null);
        return;
      }
      const canvas = mapCanvas(map);
      if (canvas) canvas.style.cursor = 'pointer';
      setOverlayHover({
        lng: row.longitude,
        lat: row.latitude,
        preview: hoverPreviewFromCadastre(row, layer),
      });
      if (row.parcelleId) applyHover(row.parcelleId);
    };
    const onOverlayLeave = () => setOverlayHover(null);
    const onOverlayClick = (e: MapLayerMouseEvent) => {
      const raw = e.features?.[0]?.properties?.parcelleId;
      const parcelleId = normalizeParcelleId(typeof raw === 'string' ? raw : null);
      if (!parcelleId) return;
      e.originalEvent.stopPropagation();
      setOverlayHover(null);
      onPick(parcelleId);
    };

    map.on('idle', paintStates);
    map.on('mousemove', PARCELLES_FILL_LAYER_ID, onMove);
    map.on('mouseleave', PARCELLES_FILL_LAYER_ID, onLeave);
    map.on('click', PARCELLES_FILL_LAYER_ID, onClick);
    map.on('mousemove', CADASTRE_DPE_LAYER_ID, onOverlayMove);
    map.on('mousemove', CADASTRE_DPE_LABEL_LAYER_ID, onOverlayMove);
    map.on('mousemove', CADASTRE_VENTES_LAYER_ID, onOverlayMove);
    map.on('mousemove', CADASTRE_COPRO_LAYER_ID, onOverlayMove);
    map.on('mouseleave', CADASTRE_DPE_LAYER_ID, onOverlayLeave);
    map.on('mouseleave', CADASTRE_DPE_LABEL_LAYER_ID, onOverlayLeave);
    map.on('mouseleave', CADASTRE_VENTES_LAYER_ID, onOverlayLeave);
    map.on('mouseleave', CADASTRE_COPRO_LAYER_ID, onOverlayLeave);
    map.on('click', CADASTRE_DPE_LAYER_ID, onOverlayClick);
    map.on('click', CADASTRE_DPE_LABEL_LAYER_ID, onOverlayClick);
    map.on('click', CADASTRE_VENTES_LAYER_ID, onOverlayClick);
    map.on('click', CADASTRE_COPRO_LAYER_ID, onOverlayClick);
    paintStates();

    return () => {
      cancelled = true;
      map.off('idle', paintStates);
      map.off('mousemove', PARCELLES_FILL_LAYER_ID, onMove);
      map.off('mouseleave', PARCELLES_FILL_LAYER_ID, onLeave);
      map.off('click', PARCELLES_FILL_LAYER_ID, onClick);
      map.off('mousemove', CADASTRE_DPE_LAYER_ID, onOverlayMove);
      map.off('mousemove', CADASTRE_DPE_LABEL_LAYER_ID, onOverlayMove);
      map.off('mousemove', CADASTRE_VENTES_LAYER_ID, onOverlayMove);
      map.off('mousemove', CADASTRE_COPRO_LAYER_ID, onOverlayMove);
      map.off('mouseleave', CADASTRE_DPE_LAYER_ID, onOverlayLeave);
      map.off('mouseleave', CADASTRE_DPE_LABEL_LAYER_ID, onOverlayLeave);
      map.off('mouseleave', CADASTRE_VENTES_LAYER_ID, onOverlayLeave);
      map.off('mouseleave', CADASTRE_COPRO_LAYER_ID, onOverlayLeave);
      map.off('click', CADASTRE_DPE_LAYER_ID, onOverlayClick);
      map.off('click', CADASTRE_DPE_LABEL_LAYER_ID, onOverlayClick);
      map.off('click', CADASTRE_VENTES_LAYER_ID, onOverlayClick);
      map.off('click', CADASTRE_COPRO_LAYER_ID, onOverlayClick);
      const canvas = mapCanvas(map);
      if (canvas) canvas.style.cursor = '';
    };
  }, [enabled, activeParcelleIds, mapRef, noteByParcelle, onPick, selectedParcelleId]);

  if (!enabled) return null;

  const dpeMatch: ExpressionSpecification = [
    'match',
    ['get', 'etiquette'],
    'A',
    DPE_PALETTE.A,
    'B',
    DPE_PALETTE.B,
    'C',
    DPE_PALETTE.C,
    'D',
    DPE_PALETTE.D,
    'E',
    DPE_PALETTE.E,
    'F',
    DPE_PALETTE.F,
    'G',
    DPE_PALETTE.G,
    PARCELLE_SLATE,
  ];

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
      <Source id={CADASTRE_POINTS_SOURCE_ID} type="geojson" data={overlayGeojson}>
        {layers.cadastreDpe ? (
          <>
            <Layer
              id={CADASTRE_DPE_LAYER_ID}
              type="circle"
              minzoom={14}
              filter={DPE_LETTER_FILTER}
              paint={{
                'circle-radius': DPE_DOT_RADIUS,
                'circle-color': dpeMatch,
                'circle-stroke-width': 1.25,
                'circle-stroke-color': '#F4EFE8',
                'circle-opacity': 0.95,
              }}
            />
            <Layer
              id={CADASTRE_DPE_LABEL_LAYER_ID}
              type="symbol"
              minzoom={17}
              filter={DPE_LETTER_FILTER}
              layout={{
                'text-field': ['get', 'etiquette'],
                'text-size': 9,
                'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
                'text-allow-overlap': true,
                'text-ignore-placement': true,
                'text-pitch-alignment': 'viewport',
                'text-rotation-alignment': 'viewport',
              }}
              paint={{
                'text-color': '#FFFFFF',
                'text-halo-color': 'rgba(0,0,0,0.25)',
                'text-halo-width': 0.6,
              }}
            />
          </>
        ) : null}
        {layers.cadastreVentes ? (
          <Layer
            id={CADASTRE_VENTES_LAYER_ID}
            type="symbol"
            filter={['==', ['get', 'hasVente'], '1']}
            layout={{
              'text-field': ['get', 'prix'],
              'text-size': 11,
              'text-offset': [0, 1.2],
              'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
              'text-allow-overlap': false,
              'text-pitch-alignment': 'viewport',
              'text-rotation-alignment': 'viewport',
            }}
            paint={{ 'text-color': VENTE_FILL, 'text-halo-color': '#F4EFE8', 'text-halo-width': 1.2 }}
          />
        ) : null}
        {layers.cadastreCopro ? (
          <Layer
            id={CADASTRE_COPRO_LAYER_ID}
            type="circle"
            filter={['==', ['get', 'hasCopro'], '1']}
            paint={{
              'circle-radius': 5,
              'circle-color': [
                'case',
                ['==', ['get', 'procedure'], '1'],
                COPRO_PROCEDURE_FILL,
                COPRO_FILL,
              ],
              'circle-stroke-width': [
                'case',
                ['==', ['get', 'procedure'], '1'],
                2,
                1,
              ],
              'circle-stroke-color': '#F4EFE8',
              'circle-pitch-alignment': 'viewport',
              'circle-pitch-scale': 'viewport',
            }}
          />
        ) : null}
      </Source>
      {overlayHover ? (
        <Popup
          longitude={overlayHover.lng}
          latitude={overlayHover.lat}
          closeButton={false}
          closeOnClick={false}
          offset={14}
          anchor="bottom"
          className="priimo-hover-popup"
        >
          <MapHoverBubble preview={overlayHover.preview} />
        </Popup>
      ) : null}
      {pins.map((m) => (
        <Marker
          key={m.parcelleId}
          longitude={m.longitude}
          latitude={m.latitude}
          anchor="center"
          style={{ zIndex: 4 }}
          onClick={(event) => {
            event.originalEvent.stopPropagation();
            onPick(m.parcelleId);
          }}
        >
          <button
            type="button"
            className="priimo-pin priimo-pin--parcelle"
            aria-label={`Note sur la parcelle ${m.parcelleId}`}
            style={{ background: PARCELLE_SLATE, color: '#fff' }}
          />
        </Marker>
      ))}
    </>
  );
}
