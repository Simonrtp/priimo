/**
 * Parcours d’estimation agent — étapes regroupées selon le type de bien.
 *
 * Six écrans maximum : les questions courtes partagent un écran quand elles
 * vont ensemble (étage + ascenseur, cave + parking + balcon…).
 */

export type EstimationStepId =
  | 'adresse'
  | 'type'
  | 'surface_pieces'
  | 'etage_ascenseur'
  | 'annexes_appart'
  | 'niveaux_terrain'
  | 'annexes_maison'
  | 'etat_dpe'
  | 'calcul'
  | 'resultat'
  | 'secteur_non_couvert';

export type EstimationPropertyType = 'appartement' | 'maison';

const COMMON_START: EstimationStepId[] = ['adresse', 'type'];

const APPART_MID: EstimationStepId[] = ['surface_pieces', 'etage_ascenseur', 'annexes_appart'];
const MAISON_MID: EstimationStepId[] = ['surface_pieces', 'niveaux_terrain', 'annexes_maison'];

/** Adresse → résultat : toujours 8 crans, quel que soit le type. */
export const PROGRESS_TOTAL = 8;

export function questionStepsFor(type: EstimationPropertyType | ''): EstimationStepId[] {
  if (type === 'maison') return [...COMMON_START, ...MAISON_MID, 'etat_dpe'];
  if (type === 'appartement') return [...COMMON_START, ...APPART_MID, 'etat_dpe'];
  // Avant le choix du type : seulement adresse + type.
  return [...COMMON_START];
}

export function allStepsFor(type: EstimationPropertyType | ''): EstimationStepId[] {
  return [...questionStepsFor(type), 'calcul', 'resultat'];
}

/**
 * Rang de progression (0 = début, barre vide).
 * Indépendant du type : appartement et maison ont la même longueur.
 */
export function progressIndex(step: EstimationStepId): number {
  switch (step) {
    case 'adresse':
    case 'secteur_non_couvert':
      return 0;
    case 'type':
      return 1;
    case 'surface_pieces':
      return 2;
    case 'etage_ascenseur':
    case 'niveaux_terrain':
      return 3;
    case 'annexes_appart':
    case 'annexes_maison':
      return 4;
    case 'etat_dpe':
      return 5;
    case 'calcul':
      return 6;
    case 'resultat':
      return 7;
    default:
      return 0;
  }
}

export const STEP_LABELS: Record<EstimationStepId, string> = {
  adresse: 'Adresse',
  type: 'Type de bien',
  surface_pieces: 'Surface et pièces',
  etage_ascenseur: 'Étage',
  annexes_appart: 'Annexes',
  niveaux_terrain: 'Niveaux et terrain',
  annexes_maison: 'Annexes',
  etat_dpe: 'État et DPE',
  calcul: 'Calcul',
  resultat: 'Résultat',
  secteur_non_couvert: 'Secteur',
};

/** Hint discret sous un champ facultatif. */
export const HINT_OPTIONAL =
  'Sans cette information, la fourchette sera plus large';
