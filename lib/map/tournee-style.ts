import type { Map as MapboxMap } from 'mapbox-gl';

/** Commerces, transports, extrusions : rien à faire pour qui marche. */
const HIDDEN = [
  'poi-label',
  'poi-scalerank1',
  'poi-scalerank2',
  'poi-scalerank3',
  'poi-scalerank4',
  'airport-label',
  'transit-label',
  'natural-point-label',
  'water-point-label',
  'building',
  'building-extrusion',
] as const;

function eachLayer(map: MapboxMap, fn: (id: string, type: string) => void): void {
  const layers = map.getStyle()?.layers;
  if (!layers) return;
  for (const layer of layers) {
    if (layer.id.startsWith('priimo-')) continue;
    fn(layer.id, layer.type);
  }
}

/** Pendant une tournée : la carte s'efface derrière le tracé. */
export function applyTourneeMapStyle(map: MapboxMap): void {
  for (const id of HIDDEN) {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, 'visibility', 'none');
    }
  }
  eachLayer(map, (id, type) => {
    if (type === 'symbol' && (id.includes('poi') || id.includes('transit'))) {
      try {
        map.setLayoutProperty(id, 'visibility', 'none');
      } catch {
        /* couche absente ou propriété illégale */
      }
    }
    if (type === 'line' && id.startsWith('road')) {
      try {
        map.setPaintProperty(id, 'line-opacity', 0.5);
      } catch {
        /* */
      }
    }
    if (type === 'symbol' && id === 'road-label') {
      try {
        map.setPaintProperty(id, 'text-opacity', 0.4);
      } catch {
        /* */
      }
    }
  });
}

export function restoreTourneeMapStyle(map: MapboxMap): void {
  for (const id of HIDDEN) {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, 'visibility', 'visible');
    }
  }
  eachLayer(map, (id, type) => {
    if (type === 'symbol' && (id.includes('poi') || id.includes('transit'))) {
      try {
        map.setLayoutProperty(id, 'visibility', 'visible');
      } catch {
        /* */
      }
    }
    if (type === 'line' && id.startsWith('road')) {
      try {
        map.setPaintProperty(id, 'line-opacity', 1);
      } catch {
        /* */
      }
    }
    if (type === 'symbol' && id === 'road-label') {
      try {
        map.setPaintProperty(id, 'text-opacity', 1);
      } catch {
        /* */
      }
    }
  });
}
