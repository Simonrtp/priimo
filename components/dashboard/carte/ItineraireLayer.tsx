'use client';

import { Layer, Marker, Source } from 'react-map-gl';
import type { ItineraireStop } from '@/lib/today/directions';
import { FIELD } from '@/lib/today/field';
import { lineGeoJson } from '@/lib/today/sortie';

const ORANGE = '#E8743C';

export default function ItineraireLayer({
  geometry,
  stops,
  onStop,
  showStops = true,
}: {
  geometry: GeoJSON.LineString | null;
  stops: readonly ItineraireStop[];
  onStop?: (stop: ItineraireStop) => void;
  showStops?: boolean;
}) {
  const line: GeoJSON.Feature<GeoJSON.LineString> = geometry
    ? { type: 'Feature', properties: {}, geometry }
    : lineGeoJson(stops);

  if (stops.length < 2 && !geometry) return null;

  return (
    <>
      <Source id="priimo-itineraire" type="geojson" data={line}>
        <Layer
          id="priimo-itineraire-casing"
          type="line"
          layout={{ 'line-cap': 'round', 'line-join': 'round' }}
          paint={{ 'line-color': '#ffffff', 'line-width': 7, 'line-opacity': 0.92 }}
        />
        <Layer
          id="priimo-itineraire-line"
          type="line"
          layout={{ 'line-cap': 'round', 'line-join': 'round' }}
          paint={{ 'line-color': ORANGE, 'line-width': 4, 'line-opacity': 1 }}
        />
      </Source>
      {showStops
        ? stops.map((stop, i) => (
            <Marker
              key={stop.leadId}
              longitude={stop.longitude}
              latitude={stop.latitude}
              anchor="center"
              style={{ zIndex: 30 }}
              onClick={(event) => {
                event.originalEvent.stopPropagation();
                onStop?.(stop);
              }}
            >
              <button
                type="button"
                className="priimo-pin"
                style={{ backgroundColor: FIELD.orange, color: '#fff' }}
                aria-label={`Arrêt ${i + 1} : ${stop.address}`}
              >
                {i + 1}
              </button>
            </Marker>
          ))
        : null}
    </>
  );
}
