import { DIRECTEUR_SEUILS } from './config';

export type StatutNegociateur = 'en_avance' | 'dans_le_rythme' | 'a_voir' | 'nouveau';

export const STATUT_NEGOCIATEUR_LABELS: Record<StatutNegociateur, string> = {
  en_avance: 'En avance',
  dans_le_rythme: 'Dans le rythme',
  a_voir: 'À voir',
  nouveau: 'Nouveau',
};

/**
 * Statut d'un négociateur vs son propre rythme des 4 semaines précédentes.
 * Jamais de classement entre négociateurs.
 */
export function statutNegociateur(input: {
  activiteRecente: number;
  moyenneHebdo4Semaines: number | null;
  semainesHistorique: number;
  seuils?: Pick<
    typeof DIRECTEUR_SEUILS,
    'decrochageSemainesHistorique' | 'statutAvanceRatio' | 'statutAVoirRatio'
  >;
}): StatutNegociateur {
  const seuils = input.seuils ?? DIRECTEUR_SEUILS;
  if (input.semainesHistorique < seuils.decrochageSemainesHistorique) {
    return 'nouveau';
  }
  const moyenne = input.moyenneHebdo4Semaines;
  if (moyenne == null || moyenne <= 0) {
    return input.activiteRecente > 0 ? 'dans_le_rythme' : 'a_voir';
  }
  const ratio = input.activiteRecente / moyenne;
  if (ratio >= seuils.statutAvanceRatio) return 'en_avance';
  if (ratio < seuils.statutAVoirRatio) return 'a_voir';
  return 'dans_le_rythme';
}

/** Ordre d'affichage des cartes négociateurs : « À voir » en premier. */
export function ordreStatutNegociateur(statut: StatutNegociateur): number {
  switch (statut) {
    case 'a_voir':
      return 0;
    case 'nouveau':
      return 1;
    case 'dans_le_rythme':
      return 2;
    case 'en_avance':
      return 3;
  }
}
