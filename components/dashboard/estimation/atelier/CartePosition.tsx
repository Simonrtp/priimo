'use client';

import { useState } from 'react';
import Map, { Marker } from 'react-map-gl';
import Modal from '@/components/ui/Modal';
import WorkspaceButton from '@/components/dashboard/workspace/WorkspaceButton';
import { MAPBOX_TOKEN, PRIIMO_MAP_STYLE } from '@/lib/map/style';
import 'mapbox-gl/dist/mapbox-gl.css';

export default function CartePosition({
  latitude,
  longitude,
  onClose,
  onChoisir,
}: {
  latitude: number | null;
  longitude: number | null;
  onClose: () => void;
  onChoisir: (lat: number, lng: number) => void;
}) {
  const [pos, setPos] = useState({
    latitude: latitude ?? 48.8566,
    longitude: longitude ?? 2.3522,
  });

  return (
    <Modal open onClose={onClose} title="Positionner sur la carte" maxWidth="2xl">
      <div className="priimo-map relative overflow-hidden rounded-clay" style={{ height: 360 }}>
        {MAPBOX_TOKEN ? (
          <Map
            mapboxAccessToken={MAPBOX_TOKEN}
            mapStyle={PRIIMO_MAP_STYLE}
            initialViewState={{ ...pos, zoom: latitude ? 17 : 11 }}
            style={{ width: '100%', height: '100%' }}
            attributionControl={false}
            onClick={(e) => setPos({ latitude: e.lngLat.lat, longitude: e.lngLat.lng })}
          >
            <Marker latitude={pos.latitude} longitude={pos.longitude} color="#1A1A1A" />
          </Map>
        ) : (
          <p className="p-6 text-[13.5px] text-text-muted">Carte indisponible.</p>
        )}
      </div>
      <div className="mt-4 flex justify-end">
        <WorkspaceButton type="button" onClick={() => onChoisir(pos.latitude, pos.longitude)}>
          Valider la position
        </WorkspaceButton>
      </div>
    </Modal>
  );
}
