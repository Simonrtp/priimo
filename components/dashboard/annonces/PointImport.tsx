'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Layer, Marker, Source, useMap } from 'react-map-gl';
import { useAnnonceImportee } from '@/lib/annonces/import/store';
import { useAnnoncesAjoutees } from '@/lib/annonces/useAnnoncesSecteur';
import { PastilleAjoutee } from './AnnoncesAjoutees';

function euros(n: number): string {
  return `${new Intl.NumberFormat('fr-FR').format(Math.round(n))} €`;
}

const SOURCE_ID = 'priimo-import-secteur';
const FILL_ID = 'priimo-import-secteur-fill';
const LINE_ID = 'priimo-import-secteur-line';

/** Cercle en mètres, collé au sol : il grandit et rétrécit avec le zoom. */
function polygoneCercle(lng: number, lat: number, rayonM: number): GeoJSON.Polygon {
  const n = 64;
  const coords: [number, number][] = [];
  const mLat = 111_320;
  const mLng = Math.max(1, 111_320 * Math.cos((lat * Math.PI) / 180));
  for (let i = 0; i <= n; i++) {
    const a = (2 * Math.PI * i) / n;
    coords.push([lng + (rayonM * Math.cos(a)) / mLng, lat + (rayonM * Math.sin(a)) / mLat]);
  }
  return { type: 'Polygon', coordinates: [coords] };
}

function SecteurImport({ longitude, latitude, rayonM }: { longitude: number; latitude: number; rayonM: number }) {
  const data = useMemo<GeoJSON.Feature<GeoJSON.Polygon>>(
    () => ({ type: 'Feature', properties: {}, geometry: polygoneCercle(longitude, latitude, rayonM) }),
    [longitude, latitude, rayonM],
  );
  return (
    <Source id={SOURCE_ID} type="geojson" data={data}>
      <Layer
        id={FILL_ID}
        type="fill"
        paint={{ 'fill-color': '#E8743C', 'fill-opacity': 0.14 }}
      />
      <Layer
        id={LINE_ID}
        type="line"
        paint={{
          'line-color': '#E8743C',
          'line-opacity': 0.75,
          'line-width': 2,
          'line-dasharray': [2, 1.4],
        }}
      />
    </Source>
  );
}

/**
 * L'annonce retrouvée par son URL : la carte y vole, le point pulse et une
 * bulle surgit au-dessus (prix, adresse courte). Adresse sûre : un point.
 * Repère seulement : un disque au sol (mètres), jamais un rond figé à l'écran.
 */
export default function PointImport({ onOuvrir }: { onOuvrir?: (annonceId: string) => void }) {
  const carte = useAnnonceImportee();
  const ajoutees = useAnnoncesAjoutees();
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

  const secteur =
    carte.approximative ? (
      <SecteurImport longitude={carte.longitude} latitude={carte.latitude} rayonM={carte.rayonM ?? 300} />
    ) : null;

  // Ajoutée : elle reste sur la carte, sous le logo de son portail. Dès que la
  // liste des annonces ajoutées la contient, c'est AnnoncesAjoutees qui la montre.
  if (carte.annonceId) {
    if (ajoutees.some((a) => a.id === carte.annonceId)) return null;
    return (
      <>
        {secteur}
        <Marker longitude={carte.longitude} latitude={carte.latitude} anchor="center" style={{ zIndex: 5 }}>
          <PastilleAjoutee
            key={carte.annonceId}
            portailCle={carte.portailCle}
            portail={carte.portail}
            prix={carte.prix}
            approximative={carte.approximative}
            onClick={() => onOuvrir?.(carte.annonceId!)}
          />
        </Marker>
      </>
    );
  }

  const rue = carte.adresse
    ? carte.adresse.replace(/\s\d{5}\s.*$/, '')
    : carte.approximative
      ? 'Secteur approximatif'
      : '';
  const bulle = (
    <span
      key={carte.url}
      className="pointer-events-none relative mb-2.5 flex items-center gap-1.5 whitespace-nowrap rounded-full bg-white px-2.5 py-1 text-[12px] shadow-[0_6px_20px_rgba(26,42,86,0.18)] motion-safe:animate-ficheSurgit"
    >
      {carte.prix != null ? <span className="font-semibold tabular-nums text-text-strong">{euros(carte.prix)}</span> : null}
      {rue ? <span className="max-w-[180px] truncate text-text-muted">{rue}</span> : null}
      <span aria-hidden className="absolute left-1/2 top-full -translate-x-1/2 border-x-[6px] border-t-[6px] border-x-transparent border-t-white" />
    </span>
  );

  return (
    <>
      {secteur}
      <Marker longitude={carte.longitude} latitude={carte.latitude} anchor="bottom" style={{ zIndex: 5 }}>
        {carte.approximative ? (
          <span aria-label={rue || 'Secteur approximatif de l’annonce'} className="relative flex flex-col items-center">
            {bulle}
          </span>
        ) : (
          <span aria-label={carte.adresse ?? 'Annonce'} className="relative flex flex-col items-center">
            {bulle}
            <span className="relative flex size-5 items-center justify-center">
              <span className="absolute inline-flex size-full rounded-full bg-accent/50 motion-safe:animate-ping" />
              <span className="relative inline-flex size-3.5 rounded-full bg-accent ring-[3px] ring-white shadow-[0_2px_8px_rgba(232,116,60,0.55)]" />
            </span>
          </span>
        )}
      </Marker>
    </>
  );
}
