'use client';

import { useEffect, useRef } from 'react';
import { Marker, useMap } from 'react-map-gl';
import { useAnnonceImportee } from '@/lib/annonces/import/store';

/**
 * L'annonce retrouvée par son URL : la carte y vole et pose un repère qui
 * pulse. Adresse sûre : un point. Repère seulement : un disque flou, jamais
 * un point qui ferait croire à une adresse.
 */
export default function PointImport() {
  const carte = useAnnonceImportee();
  const { current: map } = useMap();
  const dernier = useRef<string | null>(null);

  useEffect(() => {
    if (!map || !carte || carte.latitude == null || carte.longitude == null) return;
    const cle = `${carte.url}|${carte.latitude}|${carte.longitude}`;
    if (dernier.current === cle) return;
    dernier.current = cle;
    map.flyTo({
      center: [carte.longitude, carte.latitude],
      zoom: carte.approximative ? 15 : 17.2,
      duration: 1400,
      essential: true,
    });
  }, [map, carte]);

  if (!carte || carte.latitude == null || carte.longitude == null) return null;

  return (
    <Marker longitude={carte.longitude} latitude={carte.latitude} anchor="center" style={{ zIndex: 5 }}>
      {carte.approximative ? (
        <span aria-label="Secteur approximatif de l’annonce" className="block size-24 rounded-full border-2 border-dashed border-accent/70 bg-accent/15" />
      ) : (
        <span aria-label={carte.adresse ?? 'Annonce'} className="relative flex size-5 items-center justify-center">
          <span className="absolute inline-flex size-full rounded-full bg-accent/50 motion-safe:animate-ping" />
          <span className="relative inline-flex size-3.5 rounded-full bg-accent ring-[3px] ring-white shadow-[0_2px_8px_rgba(232,116,60,0.55)]" />
        </span>
      )}
    </Marker>
  );
}
