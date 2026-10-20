import type { Map as MapboxMap } from 'mapbox-gl';
import { FOND_IMPORT_ID, PRIIMO_MAP_CONFIG } from '@/lib/map/style';

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

/**
 * Fond Standard : ses couches vivent dans un import, hors d'atteinte des
 * identifiants ci-dessus. Commerces et transports se coupent par sa
 * configuration ; les routes s'estompent.
 */
function fondStandard(map: MapboxMap, tournee: boolean): void {
  try {
    map.setConfigProperty(FOND_IMPORT_ID, 'showPointOfInterestLabels', !tournee);
    map.setConfigProperty(FOND_IMPORT_ID, 'showTransitLabels', !tournee);
    map.setConfigProperty(FOND_IMPORT_ID, 'roadsBrightness', tournee ? 0.3 : PRIIMO_MAP_CONFIG[FOND_IMPORT_ID].roadsBrightness);
  } catch {
    /* pas de fond Standard sur cette carte */
  }
}

function stylePret(map: MapboxMap): boolean {
  try {
    return map.isStyleLoaded() && Boolean(map.getStyle()?.layers);
  } catch {
    return false;
  }
}

function eachLayer(map: MapboxMap, fn: (id: string, type: string) => void): void {
  try {
    const layers = map.getStyle()?.layers;
    if (!layers) return;
    for (const layer of layers) {
      if (layer.id.startsWith('priimo-')) continue;
      fn(layer.id, layer.type);
    }
  } catch {
    /* style pas prêt */
  }
}

function visibilite(map: MapboxMap, id: string, valeur: 'none' | 'visible'): void {
  try {
    if (!map.getLayer(id)) return;
    map.setLayoutProperty(id, 'visibility', valeur);
  } catch {
    /* couche absente, style en cours, ou propriété illégale */
  }
}

/** Pendant une tournée : la carte s'efface derrière le tracé. */
export function applyTourneeMapStyle(map: MapboxMap): void {
  if (!stylePret(map)) return;
  fondStandard(map, true);
  for (const id of HIDDEN) visibilite(map, id, 'none');
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
  if (!stylePret(map)) return;
  fondStandard(map, false);
  for (const id of HIDDEN) visibilite(map, id, 'visible');
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
