'use client';

import { useState } from 'react';
import Map, { Marker } from 'react-map-gl';
import { MAPBOX_TOKEN, PRIIMO_MAP_STYLE } from '@/lib/map/style';
import { couleurAnnonce, repereApproximatif } from '@/lib/annonces/presenter';
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
        {points.map((a) => (
          <PointAnnonce
            key={a.id}
            annonce={a}
            actif={a.id === activeId}
            onChoisir={onChoisir}
          />
        ))}
      </Map>
    </div>
  );
}

function PointAnnonce({
  annonce,
  actif,
  onChoisir,
}: {
  annonce: Annonce;
  actif: boolean;
  onChoisir: (id: string) => void;
}) {
  const [survol, setSurvol] = useState(false);
  const teinte = couleurAnnonce(annonce);
  const marque = actif || survol;
  const approx = repereApproximatif(annonce) || !['certaine', 'probable', 'adresse_publiee'].includes(annonce.confiance);
  return (
    <Marker
      latitude={annonce.latitude!}
      longitude={annonce.longitude!}
      anchor="center"
      onClick={(e) => {
        e.originalEvent.stopPropagation();
        onChoisir(annonce.id);
      }}
    >
      <span
        className="block rounded-full border-2 border-white"
        onMouseEnter={() => setSurvol(true)}
        onMouseLeave={() => setSurvol(false)}
        style={{
          width: approx ? 22 : 14,
          height: approx ? 22 : 14,
          background: teinte ? (marque ? teinte.vive : teinte.douce) : marque ? '#1A2A56' : 'rgba(26, 42, 86, 0.72)',
          opacity: approx ? 0.45 : 1,
        }}
      />
    </Marker>
  );
}
