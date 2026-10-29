'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Layer, Marker, Popup, Source, type MapRef } from 'react-map-gl';
import type { ExpressionSpecification, MapLayerMouseEvent } from 'mapbox-gl';
import {
  IGN_PCI_SOURCE_ID,
  IGN_PCI_SOURCE_LAYER,
  IGN_PCI_VECTOR_SOURCE,
} from '@/lib/map/style';
import { isUsableCoord } from '@/lib/carte/coords';
import { normalizeParcelleId } from '@/lib/carte/parcelle-id';
import { DPE_PALETTE, parseDpeLetter } from '@/lib/carte/dpe-public';
import { DEFAULT_DPE_AGE_BUCKETS } from '@/lib/carte/dpe-age';
import { dpeVisibleOnMap } from '@/lib/carte/cadastre-overlay';
import {
  COPRO_FILL,
  COPRO_PROCEDURE_FILL,
  CADASTRE_OVERLAY_MIN_ZOOM,
  FILL_PROPRIO_UNIQUE,
  PARCELLE_MIN_ZOOM,
  PARCELLE_SLATE,
  centroidLngLat,
  contenanceDepuisProps,
  surfaceCadastreM2,
  type CadastreImmeublePoint,
  type ParcelleNoteMarker,
  type ParcellePickExtra,
} from '@/lib/carte/parcelle';
import type { CadastreOverlayId, MapLayerState } from '@/lib/carte/layers';
import { hoverPreviewFromCadastre, type HoverPreview } from '@/lib/carte/hover-preview';
import { cadastreDansEmprises } from '@/lib/carte/emprise';
import { epingleSous } from '@/lib/carte/epingles';
import type { Zone } from '@/lib/zones/types';
import MapHoverBubble from '@/components/dashboard/carte/MapHoverBubble';

export const PARCELLES_FILL_LAYER_ID = 'parcelles-fill';
export const PARCELLES_LINE_LAYER_ID = 'parcelles-line';
export const CADASTRE_POINTS_SOURCE_ID = 'cadastre-immeubles';
export const CADASTRE_DPE_LAYER_ID = 'cadastre-dpe';
export const CADASTRE_DPE_LABEL_LAYER_ID = 'cadastre-dpe-label';
export const CADASTRE_COPRO_LAYER_ID = 'cadastre-copro';

/** Plan cadastral : gris papier, toutes les parcelles. */
const FILL = 'rgba(168, 174, 182, 0.34)';
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

/** Le temps de passer de la parcelle à la carte, sans qu'elle s'éteigne entre les deux. */
const HOVER_HOLD_MS = 180;

function overlayHoverIdentique(a: OverlayHover | null, b: OverlayHover): boolean {
  if (!a) return false;
  if (Math.abs(a.lng - b.lng) > 1e-7 || Math.abs(a.lat - b.lat) > 1e-7) return false;
  const pa = a.preview;
  const pb = b.preview;
  if (pa.kindLabel !== pb.kindLabel || pa.title !== pb.title || pa.letter !== pb.letter) return false;
  if (pa.lines.length !== pb.lines.length) return false;
  return pa.lines.every((line, i) => line === pb.lines[i]);
}

function overlayLayerOf(layerId: string | undefined): CadastreOverlayId | null {
  if (layerId === CADASTRE_DPE_LAYER_ID || layerId === CADASTRE_DPE_LABEL_LAYER_ID) return 'dpe';
  if (layerId === CADASTRE_COPRO_LAYER_ID) return 'copro';
  return null;
}

function pointerCanHover(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches;
}

export function parcelleIdOf(feature: { properties?: Record<string, unknown> | null } | undefined): string | null {
  return normalizeParcelleId(typeof feature?.properties?.idu === 'string' ? feature.properties.idu : null);
}

export function surfaceDepuisFeature(feature: {
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
  activeParcelleIds: _activeParcelleIds,
  proprioUniqueParcelleIds = [],
  noteMarkers,
  selectedParcelleId,
  immeubles,
  layers,
  clipZones = null,
  onPick,
  onPrefetch,
}: {
  mapRef: React.RefObject<MapRef | null>;
  enabled: boolean;
  /** Conservé pour l’API parent — le fill n’utilise plus l’état « active ». */
  activeParcelleIds: readonly string[];
  /** Appartements sans copropriété — peints plus clairement. */
  proprioUniqueParcelleIds?: readonly string[];
  noteMarkers: readonly ParcelleNoteMarker[];
  selectedParcelleId: string | null;
  immeubles: readonly CadastreImmeublePoint[];
  layers: Pick<MapLayerState, 'cadastreDpe' | 'cadastreCopro' | 'cadastreDpeAges'>;
  clipZones?: readonly Zone[] | null;
  onPick: (parcelleId: string, extra?: ParcellePickExtra) => void;
  onPrefetch?: (parcelleId: string) => void;
}) {
  const hoverId = useRef<string | null>(null);
  const painted = useRef<Set<string>>(new Set());
  const proprioUniqueSet = useRef(new Set<string>());
  proprioUniqueSet.current = new Set(proprioUniqueParcelleIds);
  const immeublesRef = useRef(immeubles);
  immeublesRef.current = immeubles;
  const selectedParcelleRef = useRef(selectedParcelleId);
  selectedParcelleRef.current = selectedParcelleId;
  const layersRef = useRef(layers);
  layersRef.current = layers;
  const clipZonesRef = useRef(clipZones);
  clipZonesRef.current = clipZones;
  const onPrefetchRef = useRef(onPrefetch);
  onPrefetchRef.current = onPrefetch;
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  const prefetchTimer = useRef<number | null>(null);
  const lastPrefetchId = useRef<string | null>(null);
  const [pins, setPins] = useState<Pin[]>([]);
  const [overlayHover, setOverlayHover] = useState<OverlayHover | null>(null);
  const pointerOnCard = useRef(false);
  const hideHoverTimer = useRef<number | null>(null);
  const showOverlays = layers.cadastreDpe || layers.cadastreCopro;

  const cancelHideHover = useCallback(() => {
    if (hideHoverTimer.current != null) {
      window.clearTimeout(hideHoverTimer.current);
      hideHoverTimer.current = null;
    }
  }, []);

  const dismissHover = useCallback(() => {
    cancelHideHover();
    pointerOnCard.current = false;
    setOverlayHover(null);
  }, [cancelHideHover]);

  const hideHoverSoon = useCallback(() => {
    if (pointerOnCard.current || hideHoverTimer.current != null) return;
    hideHoverTimer.current = window.setTimeout(() => {
      hideHoverTimer.current = null;
      if (pointerOnCard.current) return;
      setOverlayHover(null);
    }, HOVER_HOLD_MS);
  }, []);

  const showHover = useCallback(
    (next: OverlayHover) => {
      cancelHideHover();
      setOverlayHover((prev) => (overlayHoverIdentique(prev, next) ? prev : next));
    },
    [cancelHideHover],
  );

  const garderCarte = useCallback(() => {
    pointerOnCard.current = true;
    cancelHideHover();
  }, [cancelHideHover]);

  const lacherCarte = useCallback(() => {
    pointerOnCard.current = false;
    hideHoverSoon();
  }, [hideHoverSoon]);

  useEffect(() => () => cancelHideHover(), [cancelHideHover]);

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
    }, 220);
  }, []);

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
      const hasCopro = Boolean(layers.cadastreCopro) && (row.nbLots != null || row.procedureCopro);
      if (!hasDpe && !hasCopro) continue;
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [row.longitude, row.latitude] },
        properties: {
          banId: row.banId,
          parcelleId: row.parcelleId,
          hasDpe: hasDpe ? '1' : '0',
          letter: letter ?? '',
          dpeGrain: row.dpeGrain ?? '',
          dateDpe: row.dateDpe ?? '',
          surfaceDpe: row.surfaceDpe ?? '',
          etageDpe: row.etageDpe ?? '',
          hasCopro: hasCopro ? '1' : '0',
          procedure: row.procedureCopro ? '1' : '0',
        },
      });
    }
    return { type: 'FeatureCollection', features };
  }, [immeubles, layers.cadastreDpe, layers.cadastreCopro, layers.cadastreDpeAges]);

  useEffect(() => {
    dismissHover();
  }, [dismissHover, layers.cadastreDpeAges, layers.cadastreDpe, layers.cadastreCopro]);

  const noteByParcelleRef = useRef(noteByParcelle);
  noteByParcelleRef.current = noteByParcelle;
  const paintNowRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !enabled) {
      setPins([]);
      paintNowRef.current = null;
      return;
    }

    let cancelled = false;
    let paintRaf = 0;
    let settleTimer = 0;
    /** État sérialisé par parcelle — évite setFeatureState redondants. */
    const stateCache = new Map<string, string>();

    const featureKey = (parcelleId: string, featureId: string | number | undefined) =>
      `${parcelleId}|${featureId ?? parcelleId}`;

    const paintStates = () => {
      if (cancelled) return;
      // Pendant zoom/pan : ne pas bloquer le thread avec un scan PCI complet.
      if (map.isMoving() || map.isZooming() || map.isRotating()) return;
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
      const selectedId = selectedParcelleRef.current;
      const notes = noteByParcelleRef.current;

      for (const f of feats) {
        const parcelleId = parcelleIdOf(f);
        if (!parcelleId) continue;
        next.add(parcelleId);
        const centre = centroidLngLat(f.geometry);
        const hors = !cadastreDansEmprises(
          { latitude: centre?.latitude ?? null, longitude: centre?.longitude ?? null },
          clipZonesRef.current,
        );
        const state = {
          selected: selectedId === parcelleId,
          hover: hoverId.current === parcelleId,
          proprioUnique: proprioUniqueSet.current.has(parcelleId) && !hors,
          hors,
        };
        const key = featureKey(parcelleId, f.id as string | number | undefined);
        const serialized = `${state.selected ? 1 : 0}${state.hover ? 1 : 0}${state.proprioUnique ? 1 : 0}${state.hors ? 1 : 0}`;
        if (stateCache.get(key) !== serialized) {
          stateCache.set(key, serialized);
          map.setFeatureState(
            { source: IGN_PCI_SOURCE_ID, sourceLayer: IGN_PCI_SOURCE_LAYER, id: f.id ?? parcelleId },
            state,
          );
        }
        if (notes.has(parcelleId) && !hors && !pinSeen.has(parcelleId)) {
          if (centre) {
            pinSeen.add(parcelleId);
            nextPins.push({ parcelleId, longitude: centre.longitude, latitude: centre.latitude });
          }
        }
      }

      for (const [parcelleId, marker] of notes) {
        if (pinSeen.has(parcelleId)) continue;
        if (marker.latitude == null || marker.longitude == null) continue;
        if (!cadastreDansEmprises(marker, clipZonesRef.current)) continue;
        pinSeen.add(parcelleId);
        nextPins.push({ parcelleId, longitude: marker.longitude, latitude: marker.latitude });
      }

      for (const parcelleId of painted.current) {
        if (next.has(parcelleId)) continue;
        map.removeFeatureState({ source: IGN_PCI_SOURCE_ID, sourceLayer: IGN_PCI_SOURCE_LAYER, id: parcelleId });
        for (const key of stateCache.keys()) {
          if (key.startsWith(`${parcelleId}|`)) stateCache.delete(key);
        }
      }
      painted.current = next;
      if (cancelled) return;
      const pinKey = (rows: Pin[]) =>
        rows.map((p) => `${p.parcelleId}:${p.longitude.toFixed(5)}:${p.latitude.toFixed(5)}`).join('|');
      setPins((prev) => (pinKey(prev) === pinKey(nextPins) ? prev : nextPins));
    };

    paintNowRef.current = paintStates;

    const applyHover = (parcelleId: string | null) => {
      const canvas = mapCanvas(map);
      if (canvas) canvas.style.cursor = parcelleId ? 'pointer' : '';
      if (parcelleId === hoverId.current) return;
      if (hoverId.current) {
        map.setFeatureState(
          { source: IGN_PCI_SOURCE_ID, sourceLayer: IGN_PCI_SOURCE_LAYER, id: hoverId.current },
          {
            selected: selectedParcelleRef.current === hoverId.current,
            hover: false,
            proprioUnique: proprioUniqueSet.current.has(hoverId.current),
          },
        );
        for (const key of stateCache.keys()) {
          if (key.startsWith(`${hoverId.current}|`)) stateCache.delete(key);
        }
      }
      hoverId.current = parcelleId;
      if (parcelleId) {
        map.setFeatureState(
          { source: IGN_PCI_SOURCE_ID, sourceLayer: IGN_PCI_SOURCE_LAYER, id: parcelleId },
          {
            selected: selectedParcelleRef.current === parcelleId,
            hover: true,
            proprioUnique: proprioUniqueSet.current.has(parcelleId),
          },
        );
        for (const key of stateCache.keys()) {
          if (key.startsWith(`${parcelleId}|`)) stateCache.delete(key);
        }
      }
    };

    const onMove = (e: MapLayerMouseEvent) => {
      if (map.isMoving() || map.isZooming()) return;
      // Une épingle CRM couvre la parcelle : c'est elle qu'on survole.
      if (epingleSous(map, e.point)) {
        applyHover(null);
        const canvas = mapCanvas(map);
        if (canvas) canvas.style.cursor = 'pointer';
        hideHoverSoon();
        return;
      }
      const f = e.features?.[0];
      const parcelleId = parcelleIdOf(f);
      const centre = f ? centroidLngLat(f.geometry) : null;
      if (
        !cadastreDansEmprises(
          { latitude: centre?.latitude ?? e.lngLat.lat, longitude: centre?.longitude ?? e.lngLat.lng },
          clipZonesRef.current,
        )
      ) {
        applyHover(null);
        hideHoverSoon();
        return;
      }
      applyHover(parcelleId);
      schedulePrefetch(parcelleId);
      if (!pointerCanHover() || !parcelleId || !f) return;
      const overlayHits = [
        CADASTRE_DPE_LAYER_ID,
        CADASTRE_DPE_LABEL_LAYER_ID,
        CADASTRE_COPRO_LAYER_ID,
      ].filter((id) => Boolean(map.getLayer(id)));
      if (overlayHits.length > 0) {
        const top = map.queryRenderedFeatures(e.point, { layers: overlayHits });
        if (top.length > 0) return;
      }
      hideHoverSoon();
    };
    const onLeave = () => {
      applyHover(null);
      schedulePrefetch(null);
      hideHoverSoon();
    };
    const onClick = (e: MapLayerMouseEvent) => {
      // Le clic sur une épingle CRM ouvre sa fiche, pas la parcelle dessous.
      if (epingleSous(map, e.point)) return;
      // Toutes les parcelles sous le curseur (pas seulement la 1ʳᵉ) — évite les
      // clics « morts » quand une feature hors emprise ou un overlay est au-dessus.
      const hits =
        e.features && e.features.length > 0
          ? e.features
          : map.queryRenderedFeatures(e.point, { layers: [PARCELLES_FILL_LAYER_ID] });
      for (const f of hits) {
        const parcelleId = parcelleIdOf(f);
        if (!parcelleId) continue;
        const centre = centroidLngLat(f.geometry);
        const lat = centre?.latitude ?? e.lngLat.lat;
        const lng = centre?.longitude ?? e.lngLat.lng;
        if (!cadastreDansEmprises({ latitude: lat, longitude: lng }, clipZonesRef.current)) {
          continue;
        }
        e.originalEvent.stopPropagation();
        dismissHover();
        lastPrefetchId.current = parcelleId;
        onPrefetchRef.current?.(parcelleId);
        onPickRef.current(parcelleId, {
          surfaceM2: surfaceDepuisFeature(f),
          longitude: lng,
          latitude: lat,
        });
        return;
      }
    };

    const schedulePaint = () => {
      if (paintRaf) return;
      paintRaf = window.requestAnimationFrame(() => {
        paintRaf = 0;
        paintStates();
      });
    };

    /** Après un geste : 1 paint immédiat + 1 paint quand les tuiles PCI ont fini. */
    const onMoveEnd = () => {
      if (settleTimer) window.clearTimeout(settleTimer);
      schedulePaint();
      settleTimer = window.setTimeout(() => {
        settleTimer = 0;
        if (cancelled) return;
        map.once('idle', schedulePaint);
      }, 80);
    };

    map.on('moveend', onMoveEnd);
    map.on('mousemove', PARCELLES_FILL_LAYER_ID, onMove);
    map.on('mouseleave', PARCELLES_FILL_LAYER_ID, onLeave);
    map.on('click', PARCELLES_FILL_LAYER_ID, onClick);
    schedulePaint();

    return () => {
      cancelled = true;
      paintNowRef.current = null;
      if (paintRaf) window.cancelAnimationFrame(paintRaf);
      if (settleTimer) window.clearTimeout(settleTimer);
      if (prefetchTimer.current != null) {
        window.clearTimeout(prefetchTimer.current);
        prefetchTimer.current = null;
      }
      map.off('moveend', onMoveEnd);
      map.off('mousemove', PARCELLES_FILL_LAYER_ID, onMove);
      map.off('mouseleave', PARCELLES_FILL_LAYER_ID, onLeave);
      map.off('click', PARCELLES_FILL_LAYER_ID, onClick);
    };
    // noteByParcelle / sélection / proprio unique : lus via refs
    // pour ne pas ré-attacher les listeners à chaque pan ou fetch overlay.
  }, [enabled, mapRef, schedulePrefetch, showHover, hideHoverSoon, dismissHover]);

  // Repaint ciblé (sans rejouer moveend → refetch viewport).
  // activeParcelleIds n’influence plus le fill (état « active » retiré) :
  // on ne repeint que proprio unique / sélection.
  const proprioUniqueKey = proprioUniqueParcelleIds.join(',');
  useEffect(() => {
    if (!enabled) return;
    paintNowRef.current?.();
  }, [enabled, proprioUniqueKey, selectedParcelleId, noteMarkers, immeubles, clipZones]);

  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !showOverlays) {
      dismissHover();
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
            selected: selectedParcelleRef.current === hoverId.current,
            hover: false,
            proprioUnique: proprioUniqueSet.current.has(hoverId.current),
          },
        );
      }
      hoverId.current = parcelleId;
      if (parcelleId && map.getLayer(PARCELLES_FILL_LAYER_ID)) {
        map.setFeatureState(
          { source: IGN_PCI_SOURCE_ID, sourceLayer: IGN_PCI_SOURCE_LAYER, id: parcelleId },
          {
            selected: selectedParcelleRef.current === parcelleId,
            hover: true,
            proprioUnique: proprioUniqueSet.current.has(parcelleId),
          },
        );
      }
    };

    const onOverlayMove = (e: MapLayerMouseEvent) => {
      if (!pointerCanHover()) return;
      const f = e.features?.[0];
      const layer = overlayLayerOf(f?.layer?.id);
      const banId = typeof f?.properties?.banId === 'string' ? f.properties.banId : null;
      const row = banId ? immeublesRef.current.find((item) => item.banId === banId) : undefined;
      if (!layer || !row) {
        hideHoverSoon();
        return;
      }
      if (layer === 'dpe') {
        const ages = layersRef.current.cadastreDpeAges?.length
          ? layersRef.current.cadastreDpeAges
          : DEFAULT_DPE_AGE_BUCKETS;
        if (!dpeVisibleOnMap(row, ages)) {
          hideHoverSoon();
          return;
        }
      }
      if (row.parcelleId && row.parcelleId === selectedParcelleRef.current) {
        dismissHover();
        return;
      }
      const canvas = mapCanvas(map);
      if (canvas) canvas.style.cursor = 'pointer';
      showHover({
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
      hideHoverSoon();
      schedulePrefetch(null);
    };
    const onOverlayClick = (e: MapLayerMouseEvent) => {
      const f = e.features?.[0];
      const raw = f?.properties?.parcelleId;
      const parcelleId = normalizeParcelleId(typeof raw === 'string' ? raw : null);
      if (!parcelleId) return;
      e.originalEvent.stopPropagation();
      dismissHover();
      lastPrefetchId.current = parcelleId;
      onPrefetchRef.current?.(parcelleId);
      const centrePick = f ? centroidLngLat(f.geometry) : null;
      const layer = overlayLayerOf(f?.layer?.id);
      const banId = typeof f?.properties?.banId === 'string' ? f.properties.banId : null;
      const row = banId ? immeublesRef.current.find((item) => item.banId === banId) : null;
      onPickRef.current(parcelleId, {
        surfaceM2: f ? surfaceDepuisFeature(f) : null,
        longitude: centrePick?.longitude ?? e.lngLat.lng,
        latitude: centrePick?.latitude ?? e.lngLat.lat,
        dpe:
          layer === 'dpe' && row
            ? {
                banId: row.banId,
                date: row.dateDpe,
                etiquette: row.etiquetteDpe,
                etiquetteGes: null,
                consoKwhM2: null,
                surface: row.surfaceDpe,
                etage: row.etageDpe,
              }
            : null,
      });
    };

    // Le fond de plan (empreintes d'immeubles) se redessine au-dessus des
    // cercles ajoutés trop tôt. La lettre, elle, reste : d'où les C/E noirs.
    const raiseOverlays = () => {
      try {
        const order = map.getStyle()?.layers;
        if (!order) return;
        const present = [CADASTRE_DPE_LAYER_ID, CADASTRE_DPE_LABEL_LAYER_ID].filter((id) =>
          map.getLayer(id),
        );
        if (present.length === 0) return;
        const tail = order.slice(-present.length).map((layer) => layer.id);
        if (present.every((id, i) => tail[i] === id)) return;
        for (const id of present) map.moveLayer(id);
      } catch {
        /* style pas encore prêt */
      }
    };
    raiseOverlays();
    map.on('idle', raiseOverlays);

    const overlayLayers = [CADASTRE_DPE_LAYER_ID, CADASTRE_DPE_LABEL_LAYER_ID, CADASTRE_COPRO_LAYER_ID];
    for (const id of overlayLayers) {
      map.on('mousemove', id, onOverlayMove);
      map.on('mouseleave', id, onOverlayLeave);
      map.on('click', id, onOverlayClick);
    }

    return () => {
      map.off('idle', raiseOverlays);
      for (const id of overlayLayers) {
        map.off('mousemove', id, onOverlayMove);
        map.off('mouseleave', id, onOverlayLeave);
        map.off('click', id, onOverlayClick);
      }
      const canvas = mapCanvas(map);
      if (canvas && !enabled) canvas.style.cursor = '';
    };
  }, [enabled, mapRef, schedulePrefetch, showOverlays, showHover, hideHoverSoon, dismissHover]);

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
                ['boolean', ['feature-state', 'proprioUnique'], false],
                FILL_PROPRIO_UNIQUE,
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
                  ['case', ['==', ['get', 'dpeGrain'], 'adresse'], 5, 4],
                  14,
                  ['case', ['==', ['get', 'dpeGrain'], 'adresse'], 6.5, 5.5],
                  16,
                  ['case', ['==', ['get', 'dpeGrain'], 'adresse'], 8, 7],
                  18,
                  ['case', ['==', ['get', 'dpeGrain'], 'adresse'], 9, 8],
                ],
                'circle-color': DPE_CIRCLE_COLOR,
                // zoom doit rester au top-level (Mapbox refuse zoom dans un case)
                'circle-stroke-width': [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  12,
                  ['case', ['==', ['get', 'dpeGrain'], 'adresse'], 1.4, 1],
                  16,
                  ['case', ['==', ['get', 'dpeGrain'], 'adresse'], 1.6, 1.2],
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
                  11,
                ],
                'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
                'text-allow-overlap': true,
                'text-ignore-placement': true,
                'text-optional': false,
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
          <MapHoverBubble
            preview={overlayHover.preview}
            onMouseEnter={garderCarte}
            onMouseLeave={lacherCarte}
          />
        </Popup>
      ) : null}
      {pins.map((m) =>
        isUsableCoord(m.latitude, m.longitude) ? (
        <Marker
          key={m.parcelleId}
          longitude={m.longitude}
          latitude={m.latitude}
          anchor="center"
          style={{ zIndex: 4 }}
          onClick={(event) => {
            event.originalEvent.stopPropagation();
            onPick(m.parcelleId, {
              longitude: m.longitude,
              latitude: m.latitude,
            });
          }}
        >
          <button
            type="button"
            className="priimo-pin priimo-pin--parcelle"
            aria-label={`Note sur la parcelle ${m.parcelleId}`}
            style={{ background: PARCELLE_SLATE, color: '#fff' }}
          />
        </Marker>
        ) : null,
      )}
    </>
  );
}
