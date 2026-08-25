/** Jeton public Mapbox — même carte partout (prospection + secteur). */
export const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

/**
 * Rues, parcs, hydrographie. Pas le style « light » (papier blanc).
 * Le voile crème est appliqué en CSS sur `.priimo-map .mapboxgl-canvas`.
 */
export const PRIIMO_MAP_STYLE = 'mapbox://styles/mapbox/streets-v12';

export const FRANCE_MAP_VIEW = {
  longitude: 2.3522,
  latitude: 48.8566,
  zoom: 5,
};
