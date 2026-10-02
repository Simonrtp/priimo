'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Layer, Marker, Popup, Source, type MapRef } from 'react-map-gl';
import type { ExpressionSpecification, MapLayerMouseEvent } from 'mapbox-gl';
import {
  IGN_PCI_SOURCE_ID,
  IGN_PCI_SOURCE_LAYER,
  IGN_PCI_VECTOR_SOURCE,
} from '@/lib/map/style';
import { normalizeParcelleId } from '@/lib/carte/parcelle-id';
import { DPE_PALETTE, parseDpeLetter } from '@/lib/carte/dpe-public';
import { DEFAULT_DPE_AGE_BUCKETS } from '@/lib/carte/dpe-age';
import { dpeVisibleOnMap, formatPrixM2Court, ventesParParcelle } from '@/lib/carte/cadastre-overlay';
import {
  COPRO_FILL,
  COPRO_PROCEDURE_FILL,
  CADASTRE_OVERLAY_MIN_ZOOM,
  PARCELLE_MIN_ZOOM,
  PARCELLE_SLATE,
  VENTE_FILL,
  VENTE_PRICE_HALO,
  centroidLngLat,
  contenanceDepuisProps,
  surfaceCadastreM2,
  type CadastreImmeublePoint,
  type ParcelleNoteMarker,
  type ParcellePickExtra,
} from '@/lib/carte/parcelle';
import type { CadastreOverlayId, MapLayerState } from '@/lib/carte/layers';
import { hoverPreviewFromCadastre, hoverPreviewFromVenteParcelle, type HoverPreview } from '@/lib/carte/hover-preview';
import { cadastreDansEmprise } from '@/lib/carte/emprise';
import type { Zone } from '@/lib/zones/types';
import MapHoverBubble from '@/components/dashboard/carte/MapHoverBubble';

export const PARCELLES_FILL_LAYER_ID = 'parcelles-fill';
export const PARCELLES_LINE_LAYER_ID = 'parcelles-line';
export const CADASTRE_POINTS_SOURCE_ID = 'cadastre-immeubles';
export const CADASTRE_DPE_LAYER_ID = 'cadastre-dpe';
export const CADASTRE_DPE_LABEL_LAYER_ID = 'cadastre-dpe-label';
export const CADASTRE_VENTES_LAYER_ID = 'cadastre-ventes';
export const CADASTRE_VENTES_POINT_LAYER_ID = 'cadastre-ventes-point';
export const CADASTRE_VENTES_PARCELLE_SOURCE_ID = 'cadastre-ventes-parcelles';
export const CADASTRE_VENTES_PARCELLE_LABEL_LAYER_ID = 'cadastre-ventes-parcelle-label';
export const CADASTRE_COPRO_LAYER_ID = 'cadastre-copro';

/** Plan cadastral : gris papier, toutes les parcelles. */
const FILL = 'rgba(168, 174, 182, 0.34)';
const FILL_VENTE = 'rgba(92, 100, 110, 0.46)';
const FILL_HOVER = 'rgba(26, 42, 86, 0.22)';
const FILL_SELECTED = 'rgba(26, 42, 86, 0.28)';
const LINE = 'rgba(110, 116, 124, 0.78)';
const DPE_CIRCLE_COLOR: ExpressionSpecification = [
  'match',
  ['get', 'letter'],
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
  DPE_PALETTE.D,
];

type Pin = { parcelleId: string; longitude: number; latitude: number };
type OverlayHover = { lng: number; lat: number; preview: HoverPreview };

function overlayLayerOf(layerId: string | undefined): CadastreOverlayId | null {
  if (layerId === CADASTRE_DPE_LAYER_ID || layerId === CADASTRE_DPE_LABEL_LAYER_ID) return 'dpe';
  if (
    layerId === CADASTRE_VENTES_LAYER_ID ||
    layerId === CADASTRE_VENTES_POINT_LAYER_ID ||
    layerId === CADASTRE_VENTES_PARCELLE_LABEL_LAYER_ID
  ) {
    return 'ventes';
  }
  if (layerId === CADASTRE_COPRO_LAYER_ID) return 'copro';
  return null;
}

function pointerCanHover(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches;
}

function parcelleIdOf(feature: { properties?: Record<string, unknown> | null } | undefined): string | null {
  return normalizeParcelleId(typeof feature?.properties?.idu === 'string' ? feature.properties.idu : null);
}

function surfaceDepuisFeature(feature: {
  properties?: Record<string, unknown> | null;
  geometry?: unknown;
}): number | null {
  return contenanceDepuisProps(feature.properties) ?? surfaceCadastreM2(feature.geometry);
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
  activeParcelleIds,
  noteMarkers,
  selectedParcelleId,
  immeubles,
  layers,
  clipZone = null,
  onPick,
  onPrefetch,
}: {
  mapRef: React.RefObject<MapRef | null>;
  enabled: boolean;
  activeParcelleIds: readonly string[];
  noteMarkers: readonly ParcelleNoteMarker[];
  selectedParcelleId: string | null;
  immeubles: readonly CadastreImmeublePoint[];
  layers: Pick<MapLayerState, 'cadastreDpe' | 'cadastreVentes' | 'cadastreCopro' | 'cadastreDpeAges'>;
  clipZone?: Zone | null;
  onPick: (parcelleId: string, extra?: ParcellePickExtra) => void;
  onPrefetch?: (parcelleId: string) => void;
}) {
  const hoverId = useRef<string | null>(null);
  const painted = useRef<Set<string>>(new Set());
  const eventSet = useRef(new Set<string>());
  eventSet.current = new Set(activeParcelleIds);
  const immeublesRef = useRef(immeubles);
  immeublesRef.current = immeubles;
  const selectedParcelleRef = useRef(selectedParcelleId);
  selectedParcelleRef.current = selectedParcelleId;
  const layersRef = useRef(layers);
  layersRef.current = layers;
  const clipZoneRef = useRef(clipZone);
  clipZoneRef.current = clipZone;
  const onPrefetchRef = useRef(onPrefetch);
  onPrefetchRef.current = onPrefetch;
  const prefetchTimer = useRef<number | null>(null);
  const lastPrefetchId = useRef<string | null>(null);
  const [pins, setPins] = useState<Pin[]>([]);
  const [venteLabels, setVenteLabels] = useState<Pin[]>([]);
  const [overlayHover, setOverlayHover] = useState<OverlayHover | null>(null);
  const showOverlays = layers.cadastreDpe || layers.cadastreVentes || layers.cadastreCopro;

  const schedulePrefetch = useCallback((parcelleId: string | null) => {
    if (prefetchTimer.current != null) {
      window.clearTimeout(prefetchTimer.current);
      prefetchTimer.current = null;
    }
    if (!parcelleId || parcelleId === lastPrefetchId.current) return;
    prefetchTimer.current = window.setTimeout(() => {
      prefetchTimer.current = null;
      lastPrefetchId.current = parcelleId;
      onPrefetchRef.current?.(parcelleId);
    }, 70);
  }, []);

  const venteAgg = useMemo(() => ventesParParcelle(immeubles), [immeubles]);
  const venteAggRef = useRef(venteAgg);
  venteAggRef.current = venteAgg;

  const noteByParcelle = useMemo(() => {
    const map = new Map<string, ParcelleNoteMarker>();
    for (const m of noteMarkers) {
      if (!map.has(m.parcelleId)) map.set(m.parcelleId, m);
    }
    return map;
  }, [noteMarkers]);

  const overlayGeojson = useMemo<GeoJSON.FeatureCollection>(() => {
    const ages = layers.cadastreDpeAges?.length ? layers.cadastreDpeAges : DEFAULT_DPE_AGE_BUCKETS;
    const features: GeoJSON.Feature[] = [];
    for (const row of immeubles) {
      const letter = parseDpeLetter(row.etiquetteDpe);
      const hasDpe = Boolean(layers.cadastreDpe) && dpeVisibleOnMap(row, ages);
      const hasVente = Boolean(layers.cadastreVentes) && row.nbTransactions > 0;
      const hasCopro = Boolean(layers.cadastreCopro) && (row.nbLots != null || row.procedureCopro);
      if (!hasDpe && !hasVente && !hasCopro) continue;
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [row.longitude, row.latitude] },
        properties: {
          banId: row.banId,
          parcelleId: row.parcelleId,
          hasDpe: hasDpe ? '1' : '0',
          letter: letter ?? '',
          dpeGrain: row.dpeGrain ?? '',
          hasVente: hasVente ? '1' : '0',
          hasCopro: hasCopro ? '1' : '0',
          procedure: row.procedureCopro ? '1' : '0',
          prixM2: formatPrixM2Court(row.prixM2) ?? '',
        },
      });
    }
    return { type: 'FeatureCollection', features };
  }, [immeubles, layers.cadastreDpe, layers.cadastreVentes, layers.cadastreCopro, layers.cadastreDpeAges]);

  const venteParcelleGeojson = useMemo<GeoJSON.FeatureCollection>(() => {
    const features: GeoJSON.Feature[] = venteLabels.map((pin) => {
      const agg = venteAgg.get(pin.parcelleId);
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [pin.longitude, pin.latitude] },
        properties: {
          parcelleId: pin.parcelleId,
          prixM2: formatPrixM2Court(agg?.prixM2) ?? '',
        },
      };
    });
    return { type: 'FeatureCollection', features };
  }, [venteLabels, venteAgg]);

  useEffect(() => {
    setOverlayHover(null);
  }, [layers.cadastreDpeAges, layers.cadastreDpe, layers.cadastreVentes, layers.cadastreCopro]);

  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !enabled) {
      setPins([]);
      setVenteLabels([]);
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
      const nextVentes: Pin[] = [];
      const pinSeen = new Set<string>();
      const venteSeen = new Set<string>();
      const ventesOn = layersRef.current.cadastreVentes;

      for (const f of feats) {
        const parcelleId = parcelleIdOf(f);
        if (!parcelleId) continue;
        next.add(parcelleId);
        const hasVente = ventesOn && venteAggRef.current.has(parcelleId);
        const centre = centroidLngLat(f.geometry);
        const hors = !cadastreDansEmprise(
          { latitude: centre?.latitude ?? null, longitude: centre?.longitude ?? null },
          clipZoneRef.current,
        );
        map.setFeatureState(
          { source: IGN_PCI_SOURCE_ID, sourceLayer: IGN_PCI_SOURCE_LAYER, id: f.id ?? parcelleId },
          {
            active: eventSet.current.has(parcelleId),
            selected: selectedParcelleId === parcelleId,
            hover: hoverId.current === parcelleId,
            vente: hasVente && !hors,
            hors,
          },
        );
        if (hasVente && !hors && !venteSeen.has(parcelleId)) {
          const c = centroidLngLat(f.geometry);
          if (c) {
            venteSeen.add(parcelleId);
            nextVentes.push({ parcelleId, longitude: c.longitude, latitude: c.latitude });
          }
        }
        if (noteByParcelle.has(parcelleId) && !hors && !pinSeen.has(parcelleId)) {
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
        if (!cadastreDansEmprise(marker, clipZoneRef.current)) continue;
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
      setVenteLabels((prev) => {
        const key = (rows: Pin[]) =>
          rows.map((p) => `${p.parcelleId}:${p.longitude.toFixed(5)}:${p.latitude.toFixed(5)}`).join('|');
        return key(prev) === key(nextVentes) ? prev : nextVentes;
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
            vente: layersRef.current.cadastreVentes && venteAggRef.current.has(hoverId.current),
          },
        );
      }
      hoverId.current = parcelleId;
      if (parcelleId) {
        map.setFeatureState(
          { source: IGN_PCI_SOURCE_ID, sourceLayer: IGN_PCI_SOURCE_LAYER, id: parcelleId },
          {
            active: eventSet.current.has(parcelleId),
            selected: selectedParcelleId === parcelleId,
            hover: true,
            vente: layersRef.current.cadastreVentes && venteAggRef.current.has(parcelleId),
          },
        );
      }
    };

    const onMove = (e: MapLayerMouseEvent) => {
      const f = e.features?.[0];
      const parcelleId = parcelleIdOf(f);
      const centre = f ? centroidLngLat(f.geometry) : null;
      if (
        !cadastreDansEmprise(
          { latitude: centre?.latitude ?? e.lngLat.lat, longitude: centre?.longitude ?? e.lngLat.lng },
          clipZoneRef.current,
        )
      ) {
        applyHover(null);
        setOverlayHover(null);
        return;
      }
      applyHover(parcelleId);
      schedulePrefetch(parcelleId);
      if (!pointerCanHover() || !parcelleId || !f) return;
      const overlayHits = [
        CADASTRE_DPE_LAYER_ID,
        CADASTRE_DPE_LABEL_LAYER_ID,
        CADASTRE_COPRO_LAYER_ID,
        CADASTRE_VENTES_POINT_LAYER_ID,
      ].filter((id) => Boolean(map.getLayer(id)));
      if (overlayHits.length > 0) {
        const top = map.queryRenderedFeatures(e.point, { layers: overlayHits });
        if (top.length > 0) return;
      }
      if (layersRef.current.cadastreVentes) {
        const agg = venteAggRef.current.get(parcelleId);
        if (agg) {
          const c = centroidLngLat(f.geometry);
          setOverlayHover({
            lng: c?.longitude ?? e.lngLat.lng,
            lat: c?.latitude ?? e.lngLat.lat,
            preview: hoverPreviewFromVenteParcelle(agg),
          });
          return;
        }
      }
      setOverlayHover(null);
    };
    const onLeave = () => {
      applyHover(null);
      schedulePrefetch(null);
      setOverlayHover(null);
    };
    const onClick = (e: MapLayerMouseEvent) => {
      const f = e.features?.[0];
      const parcelleId = parcelleIdOf(f);
      if (!parcelleId || !f) return;
      e.originalEvent.stopPropagation();
      setOverlayHover(null);
      // Démarre le fetch avant le rendu du volet si le survol n’a pas eu le temps.
      lastPrefetchId.current = parcelleId;
      onPrefetchRef.current?.(parcelleId);
      const centre = centroidLngLat(f.geometry);
      if (
        !cadastreDansEmprise(
          { latitude: centre?.latitude ?? e.lngLat.lat, longitude: centre?.longitude ?? e.lngLat.lng },
          clipZoneRef.current,
        )
      ) {
        return;
      }
      onPick(parcelleId, { surfaceM2: surfaceDepuisFeature(f) });
    };

    map.on('idle', paintStates);
    map.on('mousemove', PARCELLES_FILL_LAYER_ID, onMove);
    map.on('mouseleave', PARCELLES_FILL_LAYER_ID, onLeave);
    map.on('click', PARCELLES_FILL_LAYER_ID, onClick);
    paintStates();

    return () => {
      cancelled = true;
      if (prefetchTimer.current != null) {
        window.clearTimeout(prefetchTimer.current);
        prefetchTimer.current = null;
      }
      map.off('idle', paintStates);
      map.off('mousemove', PARCELLES_FILL_LAYER_ID, onMove);
      map.off('mouseleave', PARCELLES_FILL_LAYER_ID, onLeave);
      map.off('click', PARCELLES_FILL_LAYER_ID, onClick);
    };
  }, [enabled, activeParcelleIds, mapRef, noteByParcelle, onPick, schedulePrefetch, selectedParcelleId, layers.cadastreVentes, venteAgg, clipZone]);

  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !showOverlays) {
      setOverlayHover(null);
      return;
    }

    const applyHover = (parcelleId: string | null) => {
      if (!enabled) return;
      const canvas = mapCanvas(map);
      if (canvas) canvas.style.cursor = parcelleId ? 'pointer' : '';
      if (parcelleId === hoverId.current) return;
      if (hoverId.current && map.getLayer(PARCELLES_FILL_LAYER_ID)) {
        map.setFeatureState(
          { source: IGN_PCI_SOURCE_ID, sourceLayer: IGN_PCI_SOURCE_LAYER, id: hoverId.current },
          {
            active: eventSet.current.has(hoverId.current),
            selected: selectedParcelleRef.current === hoverId.current,
            hover: false,
            vente: layersRef.current.cadastreVentes && venteAggRef.current.has(hoverId.current),
          },
        );
      }
      hoverId.current = parcelleId;
      if (parcelleId && map.getLayer(PARCELLES_FILL_LAYER_ID)) {
        map.setFeatureState(
          { source: IGN_PCI_SOURCE_ID, sourceLayer: IGN_PCI_SOURCE_LAYER, id: parcelleId },
          {
            active: eventSet.current.has(parcelleId),
            selected: selectedParcelleRef.current === parcelleId,
            hover: true,
            vente: layersRef.current.cadastreVentes && venteAggRef.current.has(parcelleId),
          },
        );
      }
    };

    const onOverlayMove = (e: MapLayerMouseEvent) => {
      if (!pointerCanHover()) return;
      const f = e.features?.[0];
      const layer = overlayLayerOf(f?.layer?.id);
      const banId = typeof f?.properties?.banId === 'string' ? f.properties.banId : null;
      const parcelleId = normalizeParcelleId(
        typeof f?.properties?.parcelleId === 'string' ? f.properties.parcelleId : null,
      );
      if (layer === 'ventes' && !banId && parcelleId) {
        const agg = venteAggRef.current.get(parcelleId);
        if (!agg || parcelleId === selectedParcelleRef.current) {
          setOverlayHover(null);
          return;
        }
        const canvas = mapCanvas(map);
        if (canvas) canvas.style.cursor = 'pointer';
        setOverlayHover({
          lng: e.lngLat.lng,
          lat: e.lngLat.lat,
          preview: hoverPreviewFromVenteParcelle(agg),
        });
        applyHover(parcelleId);
        return;
      }
      const row = banId ? immeublesRef.current.find((item) => item.banId === banId) : undefined;
      if (!layer || !row) {
        setOverlayHover(null);
        return;
      }
      if (layer === 'dpe') {
        const ages = layersRef.current.cadastreDpeAges?.length
          ? layersRef.current.cadastreDpeAges
          : DEFAULT_DPE_AGE_BUCKETS;
        if (!dpeVisibleOnMap(row, ages)) {
          setOverlayHover(null);
          return;
        }
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
      if (row.parcelleId) {
        applyHover(row.parcelleId);
        schedulePrefetch(row.parcelleId);
      }
    };
    const onOverlayLeave = () => {
      setOverlayHover(null);
      schedulePrefetch(null);
    };
    const onOverlayClick = (e: MapLayerMouseEvent) => {
      const f = e.features?.[0];
      const raw = f?.properties?.parcelleId;
      const parcelleId = normalizeParcelleId(typeof raw === 'string' ? raw : null);
      if (!parcelleId) return;
      e.originalEvent.stopPropagation();
      setOverlayHover(null);
      lastPrefetchId.current = parcelleId;
      onPrefetchRef.current?.(parcelleId);
      onPick(parcelleId, { surfaceM2: f ? surfaceDepuisFeature(f) : null });
    };

    const overlayLayers = [
      CADASTRE_DPE_LAYER_ID,
      CADASTRE_DPE_LABEL_LAYER_ID,
      CADASTRE_VENTES_LAYER_ID,
      CADASTRE_VENTES_POINT_LAYER_ID,
      CADASTRE_VENTES_PARCELLE_LABEL_LAYER_ID,
      CADASTRE_COPRO_LAYER_ID,
    ];
    for (const id of overlayLayers) {
      map.on('mousemove', id, onOverlayMove);
      map.on('mouseleave', id, onOverlayLeave);
      map.on('click', id, onOverlayClick);
    }

    return () => {
      for (const id of overlayLayers) {
        map.off('mousemove', id, onOverlayMove);
        map.off('mouseleave', id, onOverlayLeave);
        map.off('click', id, onOverlayClick);
      }
      const canvas = mapCanvas(map);
      if (canvas && !enabled) canvas.style.cursor = '';
    };
  }, [enabled, mapRef, onPick, schedulePrefetch, showOverlays]);

  if (!enabled && !showOverlays) return null;

  return (
    <>
      {enabled ? (
        <Source id={IGN_PCI_SOURCE_ID} {...IGN_PCI_VECTOR_SOURCE}>
          <Layer
            id={PARCELLES_FILL_LAYER_ID}
            type="fill"
            source-layer={IGN_PCI_SOURCE_LAYER}
            minzoom={PARCELLE_MIN_ZOOM}
            paint={{
              'fill-color': [
                'case',
                ['boolean', ['feature-state', 'selected'], false],
                FILL_SELECTED,
                ['boolean', ['feature-state', 'hover'], false],
                FILL_HOVER,
                ['boolean', ['feature-state', 'vente'], false],
                FILL_VENTE,
                FILL,
              ],
              'fill-opacity': ['case', ['boolean', ['feature-state', 'hors'], false], 0, 1],
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
              'line-opacity': ['case', ['boolean', ['feature-state', 'hors'], false], 0, 1],
            }}
          />
        </Source>
      ) : null}
      {showOverlays ? (
        <Source id={CADASTRE_POINTS_SOURCE_ID} type="geojson" data={overlayGeojson} promoteId="banId">
          {layers.cadastreVentes ? (
            <Layer
              id={CADASTRE_VENTES_POINT_LAYER_ID}
              type="circle"
              filter={['==', ['get', 'hasVente'], '1']}
              maxzoom={PARCELLE_MIN_ZOOM}
              paint={{
                'circle-radius': 5,
                'circle-color': VENTE_FILL,
                'circle-stroke-width': 1,
                'circle-stroke-color': VENTE_PRICE_HALO,
                'circle-pitch-alignment': 'viewport',
                'circle-pitch-scale': 'viewport',
              }}
            />
          ) : null}
          {layers.cadastreVentes ? (
            <Layer
              id={CADASTRE_VENTES_LAYER_ID}
              type="symbol"
              filter={['all', ['==', ['get', 'hasVente'], '1'], ['!=', ['get', 'prixM2'], '']]}
              minzoom={14}
              maxzoom={PARCELLE_MIN_ZOOM}
              layout={{
                'text-field': ['get', 'prixM2'],
                'text-size': 11,
                'text-offset': [1.35, 0],
                'text-anchor': 'left',
                'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
                'text-allow-overlap': false,
                'text-pitch-alignment': 'viewport',
                'text-rotation-alignment': 'viewport',
              }}
              paint={{
                'text-color': VENTE_FILL,
                'text-halo-color': VENTE_PRICE_HALO,
                'text-halo-width': 1.4,
              }}
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
          {layers.cadastreDpe ? (
            <Layer
              id={CADASTRE_DPE_LAYER_ID}
              type="circle"
              minzoom={CADASTRE_OVERLAY_MIN_ZOOM}
              filter={['==', ['get', 'hasDpe'], '1']}
              paint={{
                'circle-radius': [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  12,
                  ['case', ['==', ['get', 'dpeGrain'], 'adresse'], 6.5, 5.5],
                  14,
                  ['case', ['==', ['get', 'dpeGrain'], 'adresse'], 9, 7.5],
                  16,
                  ['case', ['==', ['get', 'dpeGrain'], 'adresse'], 12, 10],
                  18,
                  ['case', ['==', ['get', 'dpeGrain'], 'adresse'], 14, 12],
                ],
                'circle-color': DPE_CIRCLE_COLOR,
                'circle-stroke-width': [
                  'case',
                  ['==', ['get', 'dpeGrain'], 'adresse'],
                  2,
                  [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    12,
                    1,
                    16,
                    1.6,
                  ],
                ],
                'circle-stroke-color': '#F8F5F0',
                'circle-opacity': 0.96,
                'circle-pitch-alignment': 'viewport',
                'circle-pitch-scale': 'viewport',
              }}
            />
          ) : null}
          {layers.cadastreDpe ? (
            <Layer
              id={CADASTRE_DPE_LABEL_LAYER_ID}
              type="symbol"
              minzoom={14}
              filter={['==', ['get', 'hasDpe'], '1']}
              layout={{
                'text-field': ['get', 'letter'],
                'text-size': [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  14,
                  9,
                  16,
                  12,
                ],
                'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
                'text-allow-overlap': false,
                'text-ignore-placement': false,
                'text-optional': true,
                'text-pitch-alignment': 'viewport',
                'text-rotation-alignment': 'viewport',
              }}
              paint={{
                'text-color': [
                  'match',
                  ['get', 'letter'],
                  'C',
                  '#1A1A1A',
                  'D',
                  '#1A1A1A',
                  'E',
                  '#1A1A1A',
                  '#ffffff',
                ],
                'text-halo-color': [
                  'match',
                  ['get', 'letter'],
                  'C',
                  'rgba(255,255,255,0.55)',
                  'D',
                  'rgba(255,255,255,0.55)',
                  'E',
                  'rgba(255,255,255,0.4)',
                  'rgba(26,42,86,0.35)',
                ],
                'text-halo-width': 1.15,
              }}
            />
          ) : null}
        </Source>
      ) : null}
      {enabled && layers.cadastreVentes ? (
        <Source id={CADASTRE_VENTES_PARCELLE_SOURCE_ID} type="geojson" data={venteParcelleGeojson}>
          <Layer
            id={CADASTRE_VENTES_PARCELLE_LABEL_LAYER_ID}
            type="symbol"
            minzoom={PARCELLE_MIN_ZOOM}
            filter={['!=', ['get', 'prixM2'], '']}
            layout={{
              'text-field': ['get', 'prixM2'],
              'text-size': 11,
              'text-anchor': 'center',
              'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
              'text-allow-overlap': false,
              'text-pitch-alignment': 'viewport',
              'text-rotation-alignment': 'viewport',
            }}
            paint={{
              'text-color': '#3A424A',
              'text-halo-color': VENTE_PRICE_HALO,
              'text-halo-width': 1.6,
            }}
          />
        </Source>
      ) : null}

      {overlayHover ? (
        <Popup
          longitude={overlayHover.lng}
          latitude={overlayHover.lat}
          closeButton={false}
          closeOnClick={false}
          offset={18}
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
