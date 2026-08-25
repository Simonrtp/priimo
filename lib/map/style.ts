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

/**
 * Parcellaire Express (PCI) — tuiles vectorielles Géoplateforme.
 * Catalogue TMS https://data.geopf.fr/tms/1.0.0 → couche `PCI` (pbf).
 * metadata.json : source-layer `parcelle`, identifiant `idu` (14 car.).
 * Schéma des tuiles : XYZ (y=0 au nord), pas TMS inversé.
 */
export const IGN_PCI_SOURCE_ID = 'ign-pci';
export const IGN_PCI_SOURCE_LAYER = 'parcelle';
export const IGN_PCI_TILES = ['https://data.geopf.fr/tms/1.0.0/PCI/{z}/{x}/{y}.pbf'] as const;
export const IGN_PCI_MINZOOM = 15;
export const IGN_PCI_MAXZOOM = 19;
export const IGN_PCI_PROMOTE_ID = { parcelle: 'idu' } as const;

/** Source vector à ajouter au style Mapbox (aucune clé, service public). */
export const IGN_PCI_VECTOR_SOURCE = {
  type: 'vector' as const,
  tiles: [...IGN_PCI_TILES],
  minzoom: IGN_PCI_MINZOOM,
  maxzoom: IGN_PCI_MAXZOOM,
  promoteId: IGN_PCI_PROMOTE_ID,
};
