import { ACCUEIL, FIELD } from '@/lib/today/field';
import { COULEUR_FAMILLE, luminanceRelative } from '@/lib/activite/couleurs';
import type { LeadStage } from '@/types/lead';

export type StageColumnTheme = {
  bg: string;
  bgOver: string;
  accent: string;
};

/**
 * Pastels de l'agence, ceux des cartes Accueil — pas des primaires saturées.
 * Pas de violet (entonnoir), pas d'orange lead #E8743C.
 */
export const COULEURS_COLONNE = [
  COULEUR_FAMILLE.contacts_physiques.pastelFort,
  ACCUEIL.bleu,
  FIELD.ardoisePastel,
  COULEUR_FAMILLE.estimations.pastelFort,
  COULEUR_FAMILLE.contacts_qualifies.pastelFort,
  FIELD.vertPastel,
  '#D5EADF',
  COULEUR_FAMILLE.immeubles_prospectes.pastelFort,
  ACCUEIL.jaune,
  ACCUEIL.orange,
  FIELD.orangePastel,
  COULEUR_FAMILLE.informations_terrain.pastelFort,
  FIELD.rougePastel,
  COULEUR_FAMILLE.informations_terrain.pastille,
  ACCUEIL.creme,
  '#E4DFD4',
] as const;

export const COULEUR_COLONNE_DEFAUT = COULEURS_COLONNE[0];

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const value = hex.trim();
  const match = /^#([0-9a-f]{6})$/i.exec(value);
  if (!match) return null;
  const int = Number.parseInt(match[1], 16);
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  };
}

function alpha(hex: string, opacity: number, fallback: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return fallback;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
}

function assombrir(hex: string, facteur: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const f = Math.min(1, Math.max(0, facteur));
  const canal = (v: number) => Math.round(v * (1 - f))
    .toString(16)
    .padStart(2, '0');
  return `#${canal(rgb.r)}${canal(rgb.g)}${canal(rgb.b)}`;
}

function estPastel(hex: string): boolean {
  try {
    return luminanceRelative(hex) >= 0.45;
  } catch {
    return false;
  }
}

const BY_CLE: Record<string, StageColumnTheme> = {
  pris: {
    bg: FIELD.ardoisePastel,
    bgOver: '#DDE6F0',
    accent: FIELD.ardoise,
  },
  contacte: {
    bg: FIELD.creme,
    bgOver: FIELD.orangePastel,
    accent: FIELD.orange,
  },
  rendez_vous: {
    bg: FIELD.vertPastel,
    bgOver: '#D4EBE0',
    accent: FIELD.vert,
  },
  estimation: {
    bg: '#D6E9EF',
    bgOver: '#C2DEE7',
    accent: '#1F8294',
  },
  mandat: {
    bg: '#DFF0E8',
    bgOver: '#C8E6D4',
    accent: FIELD.vert,
  },
  perdu: {
    bg: FIELD.rougePastel,
    bgOver: '#F5D6D3',
    accent: FIELD.rouge,
  },
};

const FALLBACK_BY_TYPE: Record<LeadStage['type'], StageColumnTheme> = {
  entree: BY_CLE.pris,
  intermediaire: BY_CLE.contacte,
  gagne: BY_CLE.mandat,
  perdu: BY_CLE.perdu,
};

export function stageColumnTheme(
  stage: Pick<LeadStage, 'cle' | 'type'> & Partial<Pick<LeadStage, 'accentColor'>>,
): StageColumnTheme {
  if (stage.accentColor) {
    const fallback = BY_CLE[stage.cle] ?? FALLBACK_BY_TYPE[stage.type];
    if (estPastel(stage.accentColor)) {
      return {
        accent: assombrir(stage.accentColor, 0.42),
        bg: stage.accentColor,
        bgOver: assombrir(stage.accentColor, 0.08),
      };
    }
    return {
      accent: stage.accentColor,
      bg: alpha(stage.accentColor, 0.12, fallback.bg),
      bgOver: alpha(stage.accentColor, 0.2, fallback.bgOver),
    };
  }
  return BY_CLE[stage.cle] ?? FALLBACK_BY_TYPE[stage.type];
}
