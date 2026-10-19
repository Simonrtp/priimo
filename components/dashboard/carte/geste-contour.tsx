'use client';

import { useCallback, useMemo, useRef, useState, type RefObject } from 'react';
import { Layer, Source, type MapRef } from 'react-map-gl';
import { polygoneDepuisTrace, type PointTrace } from '@/lib/zones/trace';

/** Événement carte : souris ou doigt, le point écran et le lieu. */
export type GesteCarte = {
  point: { x: number; y: number };
  lngLat: { lng: number; lat: number };
};

const PAS_MINIMUM_PX = 3;
const LISSAGE_PX = 9;

function toleranceDegres(mapRef: RefObject<MapRef | null>, pixels: number): number {
  const map = mapRef.current?.getMap();
  const bornes = map?.getBounds();
  const largeur = map?.getCanvas().clientWidth ?? 0;
  if (!bornes || largeur <= 0) return 0.00001 * pixels;
  return (Math.abs(bornes.getEast() - bornes.getWest()) / largeur) * pixels;
}

function collectionDuTrace(trace: readonly PointTrace[]): GeoJSON.FeatureCollection {
  const ligne = trace.map((p) => [p[0], p[1]]);
  const features: GeoJSON.Feature[] = [
    { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: ligne } },
  ];
  if (ligne.length >= 3) {
    features.unshift({
      type: 'Feature',
      properties: {},
      geometry: { type: 'Polygon', coordinates: [[...ligne, ligne[0]!]] },
    });
  }
  return { type: 'FeatureCollection', features };
}

/**
 * Tracé à main levée sur la carte de prospection. Le geste remplace le
 * déplacement : on le termine au relâchement, et un trait trop court ne
 * devient pas un secteur.
 */
export function useGesteContour(
  actif: boolean,
  mapRef: RefObject<MapRef | null>,
  onContour: (polygone: GeoJSON.Polygon) => void,
) {
  const onContourRef = useRef(onContour);
  onContourRef.current = onContour;
  const actifRef = useRef(actif);
  actifRef.current = actif;
  const traceRef = useRef<PointTrace[]>([]);
  const enCoursRef = useRef(false);
  const dernierRef = useRef<{ x: number; y: number } | null>(null);
  const [trace, setTrace] = useState<PointTrace[]>([]);

  const debuter = useCallback((e: GesteCarte) => {
    if (!actifRef.current) return;
    enCoursRef.current = true;
    traceRef.current = [[e.lngLat.lng, e.lngLat.lat]];
    dernierRef.current = { x: e.point.x, y: e.point.y };
    setTrace(traceRef.current.slice());
  }, []);

  const prolonger = useCallback((e: GesteCarte) => {
    if (!enCoursRef.current) return;
    const dernier = dernierRef.current;
    if (dernier && Math.hypot(e.point.x - dernier.x, e.point.y - dernier.y) < PAS_MINIMUM_PX) return;
    dernierRef.current = { x: e.point.x, y: e.point.y };
    traceRef.current = [...traceRef.current, [e.lngLat.lng, e.lngLat.lat]];
    setTrace(traceRef.current.slice());
  }, []);

  const terminer = useCallback(() => {
    if (!enCoursRef.current) return;
    enCoursRef.current = false;
    const points = traceRef.current;
    traceRef.current = [];
    dernierRef.current = null;
    setTrace([]);
    const polygone = polygoneDepuisTrace(points, toleranceDegres(mapRef, LISSAGE_PX));
    if (polygone) onContourRef.current(polygone);
  }, [mapRef]);

  return { trace, debuter, prolonger, terminer };
}

/** Le trait en cours, et le contour déjà posé tant que la carte ne l'a pas repris. */
export function GesteContourCalque({
  trace,
  polygone,
  couleur,
}: {
  trace: readonly PointTrace[];
  polygone: GeoJSON.Polygon | null;
  couleur: string;
}) {
  const data = useMemo(() => collectionDuTrace(trace), [trace]);
  return (
    <>
      {polygone ? (
        <Source id="geste-fixe" type="geojson" data={{ type: 'Feature', properties: {}, geometry: polygone }}>
          <Layer id="geste-fixe-fill" type="fill" paint={{ 'fill-color': couleur, 'fill-opacity': 0.18 }} />
          <Layer
            id="geste-fixe-line"
            type="line"
            layout={{ 'line-join': 'round' }}
            paint={{ 'line-color': couleur, 'line-width': 2.5 }}
          />
        </Source>
      ) : null}
      {trace.length >= 2 ? (
        <Source id="geste-trace" type="geojson" data={data}>
          <Layer
            id="geste-trace-fill"
            type="fill"
            filter={['==', ['geometry-type'], 'Polygon']}
            paint={{ 'fill-color': couleur, 'fill-opacity': 0.12 }}
          />
          <Layer
            id="geste-trace-line"
            type="line"
            filter={['==', ['geometry-type'], 'LineString']}
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            paint={{ 'line-color': couleur, 'line-width': 3 }}
          />
        </Source>
      ) : null}
    </>
  );
}
