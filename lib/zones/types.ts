/**
 * Zones de négociateur — le découpage interne du territoire de l'agence.
 *
 * Le territoire (`agencies.codes_postaux`) décide de la livraison et de
 * l'exclusivité. Une zone ne décide que de l'attribution et de l'affichage.
 * Les deux ne se mélangent jamais.
 *
 * Une zone est un ENSEMBLE DE RÈGLES, pas une géométrie : un polygone ne peut
 * pas séparer deux côtés d'une rue distants de trois mètres, une règle de voie
 * si. Les règles se cumulent, et une règle d'exclusion permet de retirer
 * « tout ce polygone sauf la rue de Bagnolet ».
 */

export const TYPES_REGLE_ZONE = ['polygone', 'voie', 'code_postal', 'parcelles'] as const;

export type TypeRegleZone = (typeof TYPES_REGLE_ZONE)[number];

export type PariteVoie = 'toutes' | 'paires' | 'impaires';

/**
 * Contour dessiné, en convention GeoJSON : `coordinates[0]` est l'anneau
 * extérieur, les suivants sont des trous. Chaque sommet est `[lng, lat]`.
 */
export type ValeurPolygone = {
  type: 'Polygon';
  coordinates: readonly (readonly (readonly [number, number])[])[];
};

/** « Rue des Maraîchers, numéros impairs, du 1 au 45. » */
export type ValeurVoie = {
  nom_voie: string;
  code_postal: string;
  parite: PariteVoie;
  numero_min: number | null;
  numero_max: number | null;
};

/** Pour les zones larges en province, où le polygone n'apporte rien. */
export type ValeurCodePostal = {
  code_postal: string;
};

/** Ajustements fins à la parcelle. */
export type ValeurParcelles = {
  parcelle_ids: readonly string[];
};

export type ValeurRegleZone =
  | ValeurPolygone
  | ValeurVoie
  | ValeurCodePostal
  | ValeurParcelles;

type BaseRegle = {
  id: string;
  zoneId: string;
  /** false = la règle retire du périmètre au lieu d'y ajouter. */
  inclusion: boolean;
};

export type RegleZone = BaseRegle &
  (
    | { type: 'polygone'; valeur: ValeurPolygone }
    | { type: 'voie'; valeur: ValeurVoie }
    | { type: 'code_postal'; valeur: ValeurCodePostal }
    | { type: 'parcelles'; valeur: ValeurParcelles }
  );

export type Zone = {
  id: string;
  agencyId: string;
  nom: string;
  couleur: string;
  /** Titulaire. Null = zone dessinée, pas encore attribuée. */
  assignedTo: string | null;
  /** 1 = lundi. Null = pas de calendrier de tournée. */
  jourSemaine: number | null;
  actif: boolean;
  /** Verrouillé par la direction : le titulaire lit, il ne retouche plus. */
  verrouillee: boolean;
  regles: readonly RegleZone[];
};

/**
 * Ce qu'on sait d'une adresse au moment de la juger. Tout est nullable : un
 * lead mal géocodé n'a pas de coordonnées, un lead saisi à la main n'a pas
 * toujours de numéro, et aucune règle ne doit se déclencher sur une donnée
 * absente.
 */
export type AdresseAJuger = {
  latitude: number | null;
  longitude: number | null;
  /** Nom de voie sans le numéro, tel qu'écrit (la comparaison normalise). */
  nomVoie: string | null;
  numero: number | null;
  codePostal: string | null;
  parcelleId: string | null;
};

/**
 * Spécificité d'une règle : quand plusieurs zones revendiquent une adresse,
 * la règle la plus précise gagne. Une parcelle désigne un immeuble, une voie
 * un côté de rue, un polygone un quartier, un code postal une commune.
 */
export const SPECIFICITE_REGLE: Record<TypeRegleZone, number> = {
  parcelles: 4,
  voie: 3,
  polygone: 2,
  code_postal: 1,
};
