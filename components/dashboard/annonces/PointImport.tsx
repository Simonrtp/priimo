'use client';

import { useEffect, useRef } from 'react';
import { Marker, useMap } from 'react-map-gl';
import { useAnnonceImportee } from '@/lib/annonces/import/store';

function euros(n: number): string {
  return `${new Intl.NumberFormat('fr-FR').format(Math.round(n))} €`;
}

/**
 * L'annonce retrouvée par son URL : la carte y vole, le point pulse et une
 * bulle surgit au-dessus (prix, adresse courte). Adresse sûre : un point.
 * Repère seulement : un disque flou, jamais un point qui ferait croire à une
 * adresse.
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

  const rue = carte.approximative ? 'Secteur approximatif' : (carte.adresse ?? '').replace(/\s\d{5}\s.*$/, '');
  const bulle = (
    <span
      key={carte.url}
      className="pointer-events-none absolute bottom-full left-1/2 mb-2.5 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full bg-white px-2.5 py-1 text-[12px] shadow-[0_6px_20px_rgba(26,42,86,0.18)] motion-safe:animate-ficheSurgit"
    >
      {carte.prix != null ? <span className="font-semibold tabular-nums text-text-strong">{euros(carte.prix)}</span> : null}
      {rue ? <span className="max-w-[180px] truncate text-text-muted">{rue}</span> : null}
      <span aria-hidden className="absolute left-1/2 top-full -translate-x-1/2 border-x-[6px] border-t-[6px] border-x-transparent border-t-white" />
    </span>
  );

  return (
    <Marker longitude={carte.longitude} latitude={carte.latitude} anchor="center" style={{ zIndex: 5 }}>
      {carte.approximative ? (
        <span aria-label="Secteur approximatif de l’annonce" className="relative flex size-24 items-center justify-center">
          <span className="absolute inset-0 rounded-full border-2 border-dashed border-accent/70 bg-accent/15" />
          {bulle}
        </span>
      ) : (
        <span aria-label={carte.adresse ?? 'Annonce'} className="relative flex size-5 items-center justify-center">
          <span className="absolute inline-flex size-full rounded-full bg-accent/50 motion-safe:animate-ping" />
          <span className="relative inline-flex size-3.5 rounded-full bg-accent ring-[3px] ring-white shadow-[0_2px_8px_rgba(232,116,60,0.55)]" />
          {bulle}
        </span>
      )}
    </Marker>
  );
}
