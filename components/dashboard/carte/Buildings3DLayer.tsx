'use client';

import { useEffect } from 'react';
import type { MapRef } from 'react-map-gl';
import type { Map as MapboxMap } from 'mapbox-gl';

export const BUILDINGS_3D_LAYER_ID = 'priimo-buildings-3d';

/** Source vectorielle des styles Mapbox « streets » — couche `building`. */
const COMPOSITE_SOURCE_ID = 'composite';
const BUILDING_SOURCE_LAYER = 'building';

/** streets-v12 n'extrude les bâtiments qu'à partir d'environ z14. */
const MIN_ZOOM = 14;

/** Pierre chaude, cohérente avec le voile crème posé sur le canvas. */
const WALL = '#E3D9CC';
const WALL_TALL = '#D2C6B6';

/**
 * Insère les extrusions *sous* les libellés du fond de plan : les pastilles
 * DPE, les prix de vente et les copropriétés restent lisibles par-dessus.
 */
function firstLabelLayerId(map: MapboxMap): string | undefined {
  const layers = map.getStyle()?.layers;
  if (!layers) return undefined;
  for (const layer of layers) {
    if (layer.type === 'symbol' && layer.layout && 'text-field' in layer.layout) {
      return layer.id;
    }
  }
  return undefined;
}

export default function Buildings3DLayer({
  mapRef,
  enabled,
  ready,
}: {
  mapRef: React.RefObject<MapRef | null>;
  enabled: boolean;
  /** Le style doit être chargé : `mapRef` n'est pas encore posé au premier rendu. */
  ready: boolean;
}) {
  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current?.getMap();
    if (!map) return;

    const apply = () => {
      let present = false;
      try {
        present = Boolean(map.getLayer(BUILDINGS_3D_LAYER_ID));
      } catch {
        return;
      }

      if (!enabled) {
        if (present) map.removeLayer(BUILDINGS_3D_LAYER_ID);
        return;
      }
      if (present || !map.getSource(COMPOSITE_SOURCE_ID)) return;

      map.addLayer(
        {
          id: BUILDINGS_3D_LAYER_ID,
          type: 'fill-extrusion',
          source: COMPOSITE_SOURCE_ID,
          'source-layer': BUILDING_SOURCE_LAYER,
          minzoom: MIN_ZOOM,
          filter: ['==', ['get', 'extrude'], 'true'],
          paint: {
            'fill-extrusion-color': [
              'interpolate',
              ['linear'],
              ['coalesce', ['get', 'height'], 0],
              0,
              WALL,
              40,
              WALL_TALL,
            ],
            // Les murs poussent sur un demi-niveau de zoom : pas de saut visuel.
            'fill-extrusion-height': [
              'interpolate',
              ['linear'],
              ['zoom'],
              MIN_ZOOM,
              0,
              MIN_ZOOM + 1,
              ['coalesce', ['get', 'height'], 0],
            ],
            'fill-extrusion-base': [
              'interpolate',
              ['linear'],
              ['zoom'],
              MIN_ZOOM,
              0,
              MIN_ZOOM + 1,
              ['coalesce', ['get', 'min_height'], 0],
            ],
            'fill-extrusion-opacity': 0.78,
          },
        },
        firstLabelLayerId(map),
      );
    };

    if (map.isStyleLoaded()) apply();
    map.on('styledata', apply);
    return () => {
      map.off('styledata', apply);
    };
  }, [enabled, ready, mapRef]);

  return null;
}
