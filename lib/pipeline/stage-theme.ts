import { FIELD } from '@/lib/today/field';
import type { LeadStage } from '@/types/lead';

export type StageColumnTheme = {
  bg: string;
  bgOver: string;
  accent: string;
};

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

export function stageColumnTheme(stage: Pick<LeadStage, 'cle' | 'type'>): StageColumnTheme {
  return BY_CLE[stage.cle] ?? FALLBACK_BY_TYPE[stage.type];
}
