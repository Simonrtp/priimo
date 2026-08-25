'use client';

import 'mapbox-gl/dist/mapbox-gl.css';
import '@/components/dashboard/carte/carte.css';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Map, { Marker, type MapRef } from 'react-map-gl';
import { MAPBOX_TOKEN, PRIIMO_MAP_STYLE, FRANCE_MAP_VIEW } from '@/lib/map/style';
import { computeLngLatBounds } from '@/lib/carte/bounds';
import { FIELD, formatDistance } from '@/lib/today/field';
import { type SortieStop } from '@/lib/today/sortie';
import MapTokenMissing from '@/components/dashboard/map/MapTokenMissing';
import ItineraireLayer from '@/components/dashboard/carte/ItineraireLayer';
import { toItineraireStops } from '@/lib/today/directions';
import { useWalkingRoute } from '@/lib/today/use-walking-route';

const ORANGE = '#E8743C';

export default function SortieMap({
  stops,
  sectorCenter,
  hoveredIndex,
  onHoverIndex,
  onOpenItineraire,
  className = '',
}: {
  stops: readonly SortieStop[];
  sectorCenter: { latitude: number; longitude: number } | null;
  hoveredIndex: number | null;
  onHoverIndex: (index: number | null) => void;
  onOpenItineraire?: () => void;
  className?: string;
}) {
  const mapRef = useRef<MapRef | null>(null);
  const [ready, setReady] = useState(false);
  const itineraryStops = useMemo(() => toItineraireStops(stops), [stops]);
  const { route } = useWalkingRoute(itineraryStops.length >= 2 ? itineraryStops : null);

  const bounds = useMemo(() => {
    if (route?.geometry.coordinates.length) {
      return computeLngLatBounds(
        route.geometry.coordinates.map((c) => ({ longitude: c[0] ?? 0, latitude: c[1] ?? 0 })),
      );
    }
    return computeLngLatBounds(stops);
  }, [route, stops]);

  const fit = useCallback(
    (animate: boolean) => {
      const map = mapRef.current;
      if (!map) return;
      const duration = animate ? 500 : 0;
      if (bounds) {
        const [[west, south], [east, north]] = bounds;
        if (west === east && south === north) {
          map.easeTo({ center: [west, south], zoom: 15, duration });
        } else {
          map.fitBounds(bounds, { padding: 48, maxZoom: 16, duration });
        }
        return;
      }
      if (sectorCenter) {
        map.easeTo({
          center: [sectorCenter.longitude, sectorCenter.latitude],
          zoom: 13,
          duration,
        });
        return;
      }
      map.easeTo({
        center: [FRANCE_MAP_VIEW.longitude, FRANCE_MAP_VIEW.latitude],
        zoom: FRANCE_MAP_VIEW.zoom,
        duration,
      });
    },
    [bounds, sectorCenter],
  );

  useEffect(() => {
    if (ready) fit(true);
  }, [ready, fit, stops.length]);

  if (!MAPBOX_TOKEN) return <MapTokenMissing />;

  return (
    <div className={`priimo-map relative min-h-0 w-full overflow-hidden ${className}`}>
      <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle={PRIIMO_MAP_STYLE}
        onLoad={() => setReady(true)}
        onClick={() => onOpenItineraire?.()}
        initialViewState={
          bounds
            ? { bounds, fitBoundsOptions: { padding: 48, maxZoom: 16 } }
            : sectorCenter
              ? { longitude: sectorCenter.longitude, latitude: sectorCenter.latitude, zoom: 13 }
              : FRANCE_MAP_VIEW
        }
        style={{ width: '100%', height: '100%' }}
        scrollZoom
        attributionPosition="bottom-right"
      >
        {itineraryStops.length >= 2 ? (
          <ItineraireLayer geometry={route?.geometry ?? null} stops={itineraryStops} showStops={false} />
        ) : null}

        {stops.map((stop, i) => {
          const active = hoveredIndex === i;
          return (
            <Marker
              key={stop.key}
              longitude={stop.longitude}
              latitude={stop.latitude}
              anchor="center"
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                onHoverIndex(i);
              }}
            >
              <button
                type="button"
                className="priimo-pin"
                style={{
                  backgroundColor: active ? ORANGE : FIELD.ardoise,
                  color: '#fff',
                  transform: active ? 'scale(1.2)' : undefined,
                  transition: 'transform 150ms ease-out',
                }}
                onMouseEnter={() => onHoverIndex(i)}
                onMouseLeave={() => onHoverIndex(null)}
                aria-label={`Adresse ${i + 1} : ${stop.address}`}
              >
                {i + 1}
              </button>
            </Marker>
          );
        })}
      </Map>
    </div>
  );
}

export function SortieMapLegend({ distanceM }: { distanceM: number }) {
  if (distanceM <= 0) return null;
  return (
    <p className="text-[12px] text-text-muted">{formatDistance(distanceM)} à pied estimés</p>
  );
}
