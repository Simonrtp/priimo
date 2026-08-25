'use client';

import 'mapbox-gl/dist/mapbox-gl.css';
import '@/components/dashboard/carte/carte.css';

import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import Map, { Marker, type MapRef } from 'react-map-gl';
import { MAPBOX_TOKEN, PRIIMO_MAP_STYLE, FRANCE_MAP_VIEW } from '@/lib/map/style';
import { MAP_3D_BEARING, MAP_3D_PITCH } from '@/lib/map/camera';
import { computeLngLatBounds } from '@/lib/carte/bounds';
import { LEAD_FIELD_COLOR } from '@/lib/carte/colors';
import type { BuildingMarker, MapViewport } from '@/lib/carte/buildings';
import { toGeoCoord } from '@/lib/carte/coords';
import { clusterBuildings } from '@/lib/carte/cluster';
import MapTokenMissing from '@/components/dashboard/map/MapTokenMissing';
import ItineraireLayer from '@/components/dashboard/carte/ItineraireLayer';
import type { ItineraireStop } from '@/lib/today/directions';

export type MobileMapHandle = {
  recenter: (coord: { latitude: number; longitude: number }) => void;
  fitGroup: (buildings: readonly BuildingMarker[]) => void;
};

function boundsToViewport(map: MapRef): MapViewport | null {
  const b = map.getBounds();
  if (!b) return null;
  return {
    west: b.getWest(),
    south: b.getSouth(),
    east: b.getEast(),
    north: b.getNorth(),
  };
}

function fieldColor(building: BuildingMarker): string {
  if (building.appearance.kind === 'lead') return LEAD_FIELD_COLOR;
  return building.appearance.color;
}

export default function MobileMapCanvas({
  buildings,
  center,
  selectedBanId,
  mapRef: mapRefOut,
  onSelect,
  onDeselect,
  onViewport,
  onCluster,
  itineraryStops = null,
  itineraryGeometry = null,
}: {
  buildings: readonly BuildingMarker[];
  center: { latitude: number | null; longitude: number | null };
  selectedBanId: string | null;
  mapRef?: MutableRefObject<MobileMapHandle | null>;
  onSelect: (building: BuildingMarker) => void;
  onDeselect: () => void;
  onViewport: (viewport: MapViewport) => void;
  onCluster: (children: BuildingMarker[]) => void;
  itineraryStops?: readonly ItineraireStop[] | null;
  itineraryGeometry?: GeoJSON.LineString | null;
}) {
  const mapRef = useRef<MapRef | null>(null);
  const fallback = toGeoCoord(center.latitude, center.longitude);
  const [zoom, setZoom] = useState(13);

  const idsSignature = useMemo(
    () => buildings.map((b) => b.banId).sort().join(','),
    [buildings],
  );

  const initialBounds = useMemo(() => computeLngLatBounds(buildings), []); // eslint-disable-line react-hooks/exhaustive-deps

  const clustered = useMemo(() => clusterBuildings(buildings, zoom), [buildings, zoom]);

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
    (animate: boolean, group?: readonly BuildingMarker[]) => {
      const map = mapRef.current;
      if (!map) return;
      const source = group && group.length > 0 ? group : buildings;
      const bounds =
        !group && itineraryBounds ? itineraryBounds : computeLngLatBounds(source);
      const duration = animate ? 400 : 0;
      if (!bounds) {
        if (fallback) {
          map.easeTo({
            center: [fallback.longitude, fallback.latitude],
            zoom: 16,
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
          zoom: 16,
          pitch: MAP_3D_PITCH,
          bearing: MAP_3D_BEARING,
          duration,
        });
        return;
      }
      map.fitBounds(bounds, {
        padding: { top: 80, bottom: 120, left: 40, right: 40 },
        maxZoom: 17,
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

  useEffect(() => {
    if (!mapRefOut) return;
    mapRefOut.current = {
      recenter: (coord) => {
        mapRef.current?.easeTo({
          center: [coord.longitude, coord.latitude],
          zoom: 16,
          pitch: MAP_3D_PITCH,
          bearing: MAP_3D_BEARING,
          duration: 400,
        });
      },
      fitGroup: (group) => fitToPoints(true, group),
    };
    return () => {
      mapRefOut.current = null;
    };
  }, [mapRefOut, fitToPoints]);

  if (!MAPBOX_TOKEN) {
    return <MapTokenMissing />;
  }

  const showScore = zoom > 16;

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
                fitBoundsOptions: { padding: 60, maxZoom: 15 },
              }
            : fallback
              ? { longitude: fallback.longitude, latitude: fallback.latitude, zoom: 15 }
              : FRANCE_MAP_VIEW
        }
        attributionControl={false}
        dragRotate={false}
        pitchWithRotate={false}
        onLoad={() => {
          const map = mapRef.current;
          const next = map ? boundsToViewport(map) : null;
          if (next) onViewport(next);
          if (map) setZoom(map.getZoom());
          fitToPoints(false);
        }}
        onMoveEnd={(event) => {
          const b = event.target.getBounds();
          if (b) {
            onViewport({
              west: b.getWest(),
              south: b.getSouth(),
              east: b.getEast(),
              north: b.getNorth(),
            });
          }
          setZoom(event.target.getZoom());
        }}
        onClick={() => onDeselect()}
        style={{ width: '100%', height: '100%' }}
      >
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
        {clustered.map((item) => {
          if (item.kind === 'cluster') {
            return (
              <Marker
                key={item.id}
                longitude={item.longitude}
                latitude={item.latitude}
                anchor="center"
                onClick={(event) => {
                  event.originalEvent.stopPropagation();
                  onCluster(item.children);
                }}
              >
                <button
                  type="button"
                  aria-label={`${item.count} adresses`}
                  className="priimo-pin-field priimo-pin-field--cluster"
                >
                  {item.count}
                </button>
              </Marker>
            );
          }

          const building = item.building;
          const emphasized = building.banId === selectedBanId;
          const isLead = building.appearance.kind === 'lead';
          const color = fieldColor(building);
          const score = building.appearance.score;
          const withScore = showScore && isLead && typeof score === 'number';
          const label =
            building.count > 1 ? `${building.count} fiches à cette adresse` : building.appearance.title;

          return (
            <Marker
              key={building.banId}
              longitude={building.longitude}
              latitude={building.latitude}
              anchor="center"
              style={{ zIndex: emphasized ? 20 : 4 }}
              onClick={(event) => {
                event.originalEvent.stopPropagation();
                onSelect(building);
              }}
            >
              <span className="priimo-pin-wrap">
                <button
                  type="button"
                  aria-label={label}
                  className={withScore ? 'priimo-pin-field priimo-pin-field--score' : 'priimo-pin-field'}
                  style={{ background: color, boxShadow: emphasized ? '0 0 0 3px rgba(232, 116, 60, 0.35)' : undefined }}
                >
                  {withScore ? Math.round(score) : null}
                </button>
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
    </div>
  );
}
