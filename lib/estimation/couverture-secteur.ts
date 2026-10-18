import {
  DEPARTEMENTS_COUVERTS,
  departementDuCodePostal,
  secteurEstimeCouvert,
} from '@/lib/estimation/departements-couverts';

/** Absents du fichier DVF publié : Alsace-Moselle et Mayotte. */
export const DEPARTEMENTS_ABSENTS_DVF = ['57', '67', '68', '976'] as const;

export type RaisonHorsCouverture = 'absent_dvf' | 'non_charge' | 'code_invalide';

export function raisonHorsCouverture(postalCode: string | null | undefined): RaisonHorsCouverture | null {
  if (secteurEstimeCouvert(postalCode)) return null;
  const dep = departementDuCodePostal(postalCode);
  if (!dep) return 'code_invalide';
  if ((DEPARTEMENTS_ABSENTS_DVF as readonly string[]).includes(dep)) return 'absent_dvf';
  return 'non_charge';
}

export function expliquerHorsCouverture(postalCode: string | null | undefined): {
  raison: RaisonHorsCouverture;
  titre: string;
  texte: string;
} {
  const raison = raisonHorsCouverture(postalCode) ?? 'code_invalide';
  if (raison === 'absent_dvf') {
    return {
      raison,
      titre: 'Département absent du DVF',
      texte:
        'L’Alsace-Moselle (57, 67, 68) et Mayotte (976) ne figurent pas dans les demandes de valeurs foncières publiées par l’État. Aucune vente comparable n’existe pour cette adresse.',
    };
  }
  if (raison === 'non_charge') {
    return {
      raison,
      titre: 'Département non chargé',
      texte: `Les ventes de ce département ne sont pas encore chargées. Aujourd’hui, seuls les départements ${DEPARTEMENTS_COUVERTS.join(', ')} le sont.`,
    };
  }
  return {
    raison,
    titre: 'Secteur non couvert',
    texte: 'Le code postal ne permet pas de rattacher cette adresse à un département.',
  };
}
