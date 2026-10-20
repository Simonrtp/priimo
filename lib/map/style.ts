/** Jeton public Mapbox — même carte partout (prospection + secteur). */
export const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

/**
 * Mapbox Standard : immeubles, arbres et monuments en 3D, lumière réglable
 * (aube, jour, crépuscule, nuit). Ses couleurs sont celles de Priimo (crème,
 * pierre chaude, encre marine) : plus de voile CSS sur la toile, qui
 * fausserait la nuit. `FondPriimo` (enfant de chaque carte) pose la lumière,
 * range nos couches dans les étages du style et allume l'immeuble choisi.
 */
export const PRIIMO_MAP_STYLE = 'mapbox://styles/mapbox/standard';

/**
 * Cartes figées (rapports PDF, Accueil) : l'API Static Images ne prend pas
 * la configuration de Standard. Elles gardent le fond « streets ».
 */
export const PRIIMO_STATIC_MAP_STYLE = 'mapbox://styles/mapbox/streets-v12';

/** Le fond Standard s'appelle « basemap » quand la carte le charge par son URL. */
export const FOND_IMPORT_ID = 'basemap';

/** Couleur de l'immeuble choisi : l'accent orange de la charte. */
export const COULEUR_IMMEUBLE_CHOISI = '#E8743C';

/**
 * La palette Priimo appliquée au fond Standard (schéma lu sur le style
 * officiel le 20/10/2026). Passée dès la création de la carte : pas de flash
 * aux couleurs Mapbox.
 */
export const PRIIMO_MAP_CONFIG = {
  [FOND_IMPORT_ID]: {
    theme: 'default',
    lightPreset: 'day',
    colorLand: 'hsl(36, 33%, 94%)',
    colorBuildings: 'hsl(33, 24%, 89%)',
    colorWater: 'hsl(205, 42%, 80%)',
    colorGreenspace: 'hsl(92, 28%, 82%)',
    colorCommercial: 'hsl(30, 38%, 92%)',
    colorEducation: 'hsl(40, 32%, 90%)',
    colorMedical: 'hsl(8, 32%, 92%)',
    colorIndustrial: 'hsl(35, 12%, 90%)',
    colorRoads: 'hsl(40, 35%, 99%)',
    colorTrunks: 'hsl(32, 30%, 86%)',
    colorMotorways: 'hsl(28, 34%, 82%)',
    roadsBrightness: 0.6,
    colorPlaceLabels: 'hsl(225, 54%, 22%)',
    colorRoadLabels: 'hsl(225, 18%, 38%)',
    colorAdminBoundaries: 'hsl(230, 14%, 72%)',
    densityPointOfInterestLabels: 2,
    colorModePointOfInterestLabels: 'single',
    colorPointOfInterestLabels: 'hsl(30, 10%, 58%)',
    showLandmarkIcons: false,
    show3dObjects: true,
    show3dBuildings: true,
    show3dTrees: true,
    show3dLandmarks: true,
    colorBuildingHighlight: 'hsl(28, 70%, 88%)',
    colorBuildingSelect: COULEUR_IMMEUBLE_CHOISI,
  },
} as const;

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
