'use client';

import { useEffect } from 'react';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import { useControl } from 'react-map-gl';
import type { ControlPosition } from 'react-map-gl';

/**
 * Outil de dessin de secteur, branché sur la carte react-map-gl.
 *
 * Le mode `direct_select` de mapbox-gl-draw est la raison de ce choix : un
 * contour validé se reprend sommet par sommet. Un secteur se corrige, il ne se
 * redessine pas — l'agent qui a passé dix minutes à suivre une rue ne doit pas
 * tout perdre parce qu'un angle est trop large.
 */
export type DrawEvent = { features: GeoJSON.Feature[] };

export default function DrawControl({
  position = 'top-left',
  onCreate,
  onUpdate,
  onDelete,
  onSelectionChange,
  onReady,
  couleur,
}: {
  position?: ControlPosition;
  onCreate?: (e: DrawEvent) => void;
  onUpdate?: (e: DrawEvent) => void;
  onDelete?: (e: DrawEvent) => void;
  onSelectionChange?: (e: DrawEvent) => void;
  onReady?: (draw: MapboxDraw) => void;
  /** Teinte du secteur en cours, pour dessiner dans sa couleur. */
  couleur: string;
}) {
  type Emetteur = {
    on: (t: string, cb: (e: DrawEvent) => void) => void;
    off: (t: string, cb: (e: DrawEvent) => void) => void;
  };

  const brancher = (map: { getMap: () => unknown }, sens: 'on' | 'off') => {
    // Les événements draw.* ne figurent pas dans le typage Mapbox.
    const cible = map.getMap() as Emetteur;
    if (onCreate) cible[sens]('draw.create', onCreate);
    if (onUpdate) cible[sens]('draw.update', onUpdate);
    if (onDelete) cible[sens]('draw.delete', onDelete);
    if (onSelectionChange) cible[sens]('draw.selectionchange', onSelectionChange);
  };

  // mapbox-gl-draw est typé contre les types mapbox-gl, react-map-gl contre sa
  // propre abstraction : les deux décrivent la même carte, le pont se fait ici.
  const draw = useControl<never>(
    () =>
      new MapboxDraw({
        displayControlsDefault: false,
        // Pas de barre d'outils Mapbox : les boutons vivent dans le panneau
        // latéral, en design clay, avec le reste des actions.
        controls: {},
        styles: dessinStyles(couleur),
      }) as never,
    ({ map }) => brancher(map, 'on'),
    ({ map }) => brancher(map, 'off'),
    { position },
  ) as unknown as MapboxDraw;

  useEffect(() => {
    onReady?.(draw);
  }, [draw, onReady]);

  return null;
}

/** Le tracé en cours reprend la couleur du secteur : aucune surprise à la validation. */
function dessinStyles(couleur: string) {
  return [
    {
      id: 'gl-draw-polygon-fill',
      type: 'fill',
      filter: ['all', ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']],
      paint: { 'fill-color': couleur, 'fill-opacity': 0.12 },
    },
    {
      id: 'gl-draw-polygon-stroke',
      type: 'line',
      filter: ['all', ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': couleur, 'line-width': 2.5 },
    },
    {
      id: 'gl-draw-line',
      type: 'line',
      filter: ['all', ['==', '$type', 'LineString'], ['!=', 'mode', 'static']],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': couleur, 'line-width': 2.5, 'line-dasharray': [0.4, 2] },
    },
    {
      id: 'gl-draw-polygon-and-line-vertex-halo',
      type: 'circle',
      filter: ['all', ['==', 'meta', 'vertex'], ['==', '$type', 'Point']],
      paint: { 'circle-radius': 7, 'circle-color': '#FFFFFF' },
    },
    {
      id: 'gl-draw-polygon-and-line-vertex',
      type: 'circle',
      filter: ['all', ['==', 'meta', 'vertex'], ['==', '$type', 'Point']],
      paint: { 'circle-radius': 4.5, 'circle-color': couleur },
    },
    {
      id: 'gl-draw-polygon-midpoint',
      type: 'circle',
      filter: ['all', ['==', 'meta', 'midpoint'], ['==', '$type', 'Point']],
      paint: { 'circle-radius': 3, 'circle-color': couleur, 'circle-opacity': 0.55 },
    },
  ];
}
