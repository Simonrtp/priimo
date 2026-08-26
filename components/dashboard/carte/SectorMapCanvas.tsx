'use client';

import 'mapbox-gl/dist/mapbox-gl.css';
import './carte.css';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Map, { Marker, type MapRef } from 'react-map-gl';
import { MAPBOX_TOKEN, PRIIMO_MAP_STYLE, FRANCE_MAP_VIEW } from '@/lib/map/style';
import { MAP_3D_BEARING, MAP_3D_PITCH } from '@/lib/map/camera';
import { computeLngLatBounds } from '@/lib/carte/bounds';
import { markerBadgeColor } from '@/lib/carte/colors';
import type { BuildingMarker, MapViewport } from '@/lib/carte/buildings';
import { toGeoCoord } from '@/lib/carte/coords';
import { buildScoreHeatScale } from '@/lib/lead-geo';
import MapTokenMissing from '@/components/dashboard/map/MapTokenMissing';
import MapZoomControls from '@/components/dashboard/map/MapZoomControls';
import ScoreRing from '@/components/dashboard/ScoreRing';
import ItineraireLayer from '@/components/dashboard/carte/ItineraireLayer';
import ParcellesLayer, {
  CADASTRE_COPRO_LAYER_ID,
  CADASTRE_DPE_LAYER_ID,
  CADASTRE_VENTES_LAYER_ID,
  PARCELLES_FILL_LAYER_ID,
} from '@/components/dashboard/carte/ParcellesLayer';
import type { ItineraireStop } from '@/lib/today/directions';
import type { CadastreImmeublePoint, ParcelleNoteMarker } from '@/lib/carte/parcelle';
import type { MapLayerState } from '@/lib/carte/layers';

function boundsToViewport(map: MapRef): MapViewport | null {
  const b = map.getBounds();
  if (!b) return null;
  return {
    west: b.getWest(),
    south: b.getSouth(),
    east: b.getEast(),
    north: b.getNorth(),
    zoom: map.getZoom(),
  };
}

export default function SectorMapCanvas({
  buildings,
  center,
  selectedBanId,
  onSelect,
  onDeselect,
  onViewport,
  itineraryStops = null,
  itineraryGeometry = null,
  parcellesEnabled = false,
  activeParcelleIds = [],
  parcelleNoteMarkers = [],
  selectedParcelleId = null,
  cadastreImmeubles = [],
  cadastreLayers = { cadastreDpe: false, cadastreVentes: false, cadastreCopro: false },
  onSelectParcelle,
}: {
  buildings: readonly BuildingMarker[];
  center: { latitude: number | null; longitude: number | null };
  selectedBanId: string | null;
  onSelect: (building: BuildingMarker) => void;
  onDeselect: () => void;
  onViewport: (viewport: MapViewport) => void;
  itineraryStops?: readonly ItineraireStop[] | null;
  itineraryGeometry?: GeoJSON.LineString | null;
  parcellesEnabled?: boolean;
  activeParcelleIds?: readonly string[];
  parcelleNoteMarkers?: readonly ParcelleNoteMarker[];
  selectedParcelleId?: string | null;
  cadastreImmeubles?: readonly CadastreImmeublePoint[];
  cadastreLayers?: Pick<MapLayerState, 'cadastreDpe' | 'cadastreVentes' | 'cadastreCopro'>;
  onSelectParcelle?: (parcelleId: string) => void;
}) {
  const mapRef = useRef<MapRef | null>(null);
  const fallback = toGeoCoord(center.latitude, center.longitude);

  const idsSignature = useMemo(
    () => buildings.map((b) => b.banId).sort().join(','),
    [buildings],
  );

  const initialBounds = useMemo(() => computeLngLatBounds(buildings), []); // eslint-disable-line react-hooks/exhaustive-deps

  const heatFor = useMemo(
    () =>
      buildScoreHeatScale(
        buildings
          .filter((b) => b.appearance.kind === 'lead')
          .map((b) => b.appearance.score ?? 0),
      ),
    [buildings],
  );

  const itineraryBounds = useMemo(() => {
    if (itineraryGeometry?.coordinates?.length) {
      return computeLngLatBounds(
        itineraryGeometry.coordinates.map((c) => ({ longitude: c[0] ?? 0, latitude: c[1] ?? 0 })),
      );
    }
    if (itineraryStops && itineraryStops.length > 0) return computeLngLatBounds(itineraryStops);
    return null;
  }, [itineraryGeometry, itineraryStops]);

  const fitToPoints = useCallback(
    (animate: boolean) => {
      const map = mapRef.current;
      if (!map) return;
      const bounds = itineraryBounds ?? computeLngLatBounds(buildings);
      const duration = animate ? 700 : 0;
      if (!bounds) {
        if (fallback) {
          map.easeTo({
            center: [fallback.longitude, fallback.latitude],
            zoom: 13,
            pitch: MAP_3D_PITCH,
            bearing: MAP_3D_BEARING,
            duration,
          });
        } else {
          map.easeTo({
            center: [FRANCE_MAP_VIEW.longitude, FRANCE_MAP_VIEW.latitude],
            zoom: FRANCE_MAP_VIEW.zoom,
            duration,
          });
        }
        return;
      }
      const [[west, south], [east, north]] = bounds;
      if (west === east && south === north) {
        map.easeTo({
          center: [west, south],
          zoom: 14,
          pitch: MAP_3D_PITCH,
          bearing: MAP_3D_BEARING,
          duration,
        });
        return;
      }
      map.fitBounds(bounds, {
        padding: { top: 80, bottom: 80, left: 80, right: 80 },
        maxZoom: 15,
        duration,
        pitch: MAP_3D_PITCH,
        bearing: MAP_3D_BEARING,
      });
    },
    [fallback, buildings, itineraryBounds],
  );

  useEffect(() => {
    fitToPoints(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsSignature, itineraryBounds]);

  if (!MAPBOX_TOKEN) {
    return <MapTokenMissing />;
  }

  return (
    <div className="priimo-map relative z-0 h-full min-h-0 w-full overflow-hidden">
      <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle={PRIIMO_MAP_STYLE}
        initialViewState={
          initialBounds
            ? {
                bounds: initialBounds,
                fitBoundsOptions: { padding: 80, maxZoom: 15 },
              }
            : fallback
              ? { longitude: fallback.longitude, latitude: fallback.latitude, zoom: 13 }
              : FRANCE_MAP_VIEW
        }
        attributionControl={false}
        interactiveLayerIds={
          parcellesEnabled
            ? [
                PARCELLES_FILL_LAYER_ID,
                CADASTRE_DPE_LAYER_ID,
                CADASTRE_VENTES_LAYER_ID,
                CADASTRE_COPRO_LAYER_ID,
              ]
            : []
        }
        onLoad={() => {
          const map = mapRef.current;
          const next = map ? boundsToViewport(map) : null;
          if (next) onViewport(next);
          fitToPoints(false);
        }}
        onMoveEnd={(event) => {
          const b = event.target.getBounds();
          if (!b) return;
          onViewport({
            west: b.getWest(),
            south: b.getSouth(),
            east: b.getEast(),
            north: b.getNorth(),
            zoom: event.target.getZoom(),
          });
        }}
        onClick={(event) => {
          if (parcellesEnabled && event.target.getLayer(PARCELLES_FILL_LAYER_ID)) {
            const hits = event.target.queryRenderedFeatures(event.point, {
              layers: [PARCELLES_FILL_LAYER_ID],
            });
            if (hits.length > 0) return;
          }
          onDeselect();
        }}
        style={{ width: '100%', height: '100%' }}
      >
        <ParcellesLayer
          mapRef={mapRef}
          enabled={parcellesEnabled}
          activeParcelleIds={activeParcelleIds}
          noteMarkers={parcelleNoteMarkers}
          selectedParcelleId={selectedParcelleId}
          immeubles={cadastreImmeubles}
          layers={cadastreLayers}
          onPick={(parcelleId) => onSelectParcelle?.(parcelleId)}
        />
        {itineraryStops && itineraryStops.length >= 2 ? (
          <ItineraireLayer
            geometry={itineraryGeometry}
            stops={itineraryStops}
            onStop={(stop) => {
              const building = buildings.find((b) => b.banId && b.banId === stop.banId);
              if (building) onSelect(building);
            }}
          />
        ) : null}
        {buildings.map((building) => {
          const emphasized = building.banId === selectedBanId;
          const appearance = building.appearance;
          const isLead = appearance.kind === 'lead';
          const score = appearance.score ?? 0;
          const heat = isLead ? heatFor(score) : null;
          const text = markerBadgeColor(appearance.color);
          const countLabel =
            building.count > 1 ? `${building.count} fiches à cette adresse` : appearance.title;
          return (
            <Marker
              key={building.banId}
              longitude={building.longitude}
              latitude={building.latitude}
              anchor="center"
              style={{ zIndex: emphasized ? 20 : isLead ? 10 + Math.round(score / 10) : 2 }}
              onClick={(event) => {
                event.originalEvent.stopPropagation();
                onSelect(building);
              }}
            >
              <span className="priimo-pin-wrap">
                {isLead && heat ? (
                  <button type="button" aria-label={countLabel} className="cursor-pointer">
                    <ScoreRing
                      score={score}
                      size={heat.size}
                      emphasized={emphasized}
                      glowColor={heat.glow}
                    />
                  </button>
                ) : (
                  <button
                    type="button"
                    aria-label={countLabel}
                    className={`priimo-pin${emphasized ? ' priimo-pin--on' : ''}`}
                    style={{ background: appearance.color, color: text }}
                  >
                    {appearance.badge}
                  </button>
                )}
                {building.count > 1 ? (
                  <span className="priimo-pin-count" aria-hidden>
                    {building.count}
                  </span>
                ) : null}
              </span>
            </Marker>
          );
        })}
      </Map>

      <MapZoomControls
        className="absolute bottom-3 right-3 z-30 flex flex-col gap-1.5"
        onZoomIn={() => mapRef.current?.zoomIn({ duration: 300 })}
        onZoomOut={() => mapRef.current?.zoomOut({ duration: 300 })}
        onFit={() => fitToPoints(true)}
      />
    </div>
  );
}
