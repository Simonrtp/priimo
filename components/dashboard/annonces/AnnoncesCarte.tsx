'use client';

import Map, { Marker } from 'react-map-gl';
import { MAPBOX_TOKEN, PRIIMO_MAP_STYLE } from '@/lib/map/style';
import { repereApproximatif } from '@/lib/annonces/presenter';
import type { Annonce } from '@/lib/annonces/types';
import 'mapbox-gl/dist/mapbox-gl.css';

export default function AnnoncesCarte({
  annonces,
  activeId,
  onChoisir,
}: {
  annonces: Annonce[];
  activeId: string | null;
  onChoisir: (id: string) => void;
}) {
  const points = annonces.filter((a) => a.latitude != null && a.longitude != null);
  const premier = points[0];
  if (!MAPBOX_TOKEN || !premier) {
    return (
      <div className="flex h-full items-center justify-center rounded-clay bg-bg-subtle p-6 text-[13px] text-text-muted">
        Carte indisponible pour ces annonces.
      </div>
    );
  }
  return (
    <div className="priimo-map h-full overflow-hidden rounded-clay">
      <Map
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle={PRIIMO_MAP_STYLE}
        initialViewState={{
          latitude: premier.latitude!,
          longitude: premier.longitude!,
          zoom: 14,
        }}
        style={{ width: '100%', height: '100%' }}
        attributionControl={false}
      >
        {points.map((a) => {
          const approx = repereApproximatif(a) || !['certaine', 'probable', 'adresse_publiee'].includes(a.confiance);
          const actif = a.id === activeId;
          return (
            <Marker
              key={a.id}
              latitude={a.latitude!}
              longitude={a.longitude!}
              anchor="center"
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                onChoisir(a.id);
              }}
            >
              <span
                className="block rounded-full border-2 border-white"
                style={{
                  width: approx ? 22 : 14,
                  height: approx ? 22 : 14,
                  background: actif ? '#1A2A56' : 'rgba(26, 42, 86, 0.72)',
                  opacity: approx ? 0.45 : 1,
                }}
              />
            </Marker>
          );
        })}
      </Map>
    </div>
  );
}
