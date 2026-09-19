'use client';

import Map, { Marker } from 'react-map-gl';
import { MAPBOX_TOKEN, PRIIMO_MAP_STYLE } from '@/lib/map/style';
import 'mapbox-gl/dist/mapbox-gl.css';

export default function CartePosition({
  latitude,
  longitude,
  onChoisir,
}: {
  latitude: number;
  longitude: number;
  onChoisir?: (lat: number, lng: number) => void;
}) {
  return (
    <div className="priimo-map relative mt-3 h-40 overflow-hidden rounded-clay bg-bg-subtle">
      {MAPBOX_TOKEN ? (
        <Map
          key={`${latitude.toFixed(5)}-${longitude.toFixed(5)}`}
          mapboxAccessToken={MAPBOX_TOKEN}
          mapStyle={PRIIMO_MAP_STYLE}
          initialViewState={{ latitude, longitude, zoom: 16 }}
          style={{ width: '100%', height: '100%' }}
          attributionControl={false}
          onClick={
            onChoisir
              ? (e) => onChoisir(e.lngLat.lat, e.lngLat.lng)
              : undefined
          }
        >
          <Marker latitude={latitude} longitude={longitude} color="#1A1A1A" />
        </Map>
      ) : (
        <p className="p-3 text-[12.5px] text-text-muted">Carte indisponible.</p>
      )}
    </div>
  );
}
