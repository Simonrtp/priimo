/**
 * Table unique des coefficients du moteur.
 * Valeurs prudentes, prévues pour être remplacées par la grille de l’agence.
 * Les annexes sont en euros, jamais en % du m².
 */

export const MOTEUR_CONFIG = {
  CERCLES_M: [300, 600, 1000] as const,
  CERCLES_MAISON_M: [500, 1000, 2000] as const,
  FENETRES_MOIS: [24, 36, 60] as const,
  CIBLE_VENTES: 8,
  MIN_VENTES: 3,
  MAD_SEUIL: 2.5,
  SURFACE_TOLERANCE: 0.3,
  MIN_TRIMESTRES_INDICE: 4,
  MIN_VENTES_TRIMESTRE: 4,

  ETAGE: {
    RDC_PCT: -0.06,
    DERNIER_PCT: 0.04,
    ELEVE_SANS_ASC_PCT: -0.05,
    ASCENSEUR_PCT: 0.02,
    ELEVE_DES: 3,
  },
  BALCON_TERRASSE_PCT: 0.03,
  ETAT: {
    1: -0.12,
    2: -0.05,
    3: 0,
    4: 0.04,
  } as Record<number, number>,
  DPE: {
    A: 0.03,
    B: 0.02,
    C: 0,
    D: 0,
    E: -0.03,
    F: -0.08,
    G: -0.1,
  } as Record<string, number>,
  ANNEXES_EUR: {
    cave: 4_000,
    parking: 15_000,
    box: 12_000,
  },
  POIDS: {
    IMMEUBLE: 3,
    RUE: 1.6,
    DIST_REF_M: 200,
    AGE_REF_MOIS: 24,
    SURFACE_SIGMA: 0.25,
  },
} as const;

export type MoteurConfig = typeof MOTEUR_CONFIG;
