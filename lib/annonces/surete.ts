import type { Confiance } from './types';

/**
 * L'indice de sûreté d'une adresse d'annonce : Sûre, Probable, À vérifier, En attente.
 *
 * Taux mesurés au banc d'essai du 23/10/2026 : 70 DPE réels de Paris 10e, 11e,
 * 12e et 20e transformés en annonces SeLoger (conso chiffrée, quartier, fourchette
 * des dépenses d'énergie), PAP (lettres, rue, point approché) et Leboncoin (lettres,
 * fourchette, position floutée à 800 m), surfaces arrondies ou décalées comme sur
 * les portails, étage publié 85 fois sur 100. Deux cas : le DPE de l'annonce est
 * dans la base ADEME, ou pas encore (il est alors retiré de chaque réponse).
 *
 *                 DPE publié                      DPE pas encore publié
 *   SeLoger       sûre 60/60, probable 7/7        sûre 3/3, probable 1/6
 *   PAP           sûre 10/10, probable 22/22      sûre 1/1, probable 12/18
 *   Leboncoin     sûre 10/10, probable 15/15      sûre 0/1, probable 1/6
 *   « À vérifier » : le bon immeuble est dans la liste 9 fois sur 10 quand le DPE est publié.
 *
 * Avec environ une annonce sur sept dont le DPE n'est pas encore publié :
 * moins de 1 % d'erreur en « sûre », environ 6 % en « probable ».
 */
export type NiveauSurete = 'sure' | 'probable' | 'a_verifier' | 'secteur';

export function niveauSurete(confiance: Confiance, nbPossibles = 0): NiveauSurete {
  if (confiance === 'certaine' || confiance === 'adresse_publiee') return 'sure';
  if (confiance === 'probable') return 'probable';
  return nbPossibles > 0 ? 'a_verifier' : 'secteur';
}

export const SURETE: Record<NiveauSurete, { libelle: string; titre: string; aide: string; fond: string; texte: string; point: string }> = {
  sure: {
    libelle: 'Sûre',
    titre: 'Adresse sûre',
    aide: 'Le DPE de l’annonce ou la carte du portail désigne cet immeuble sans hésitation. Moins d’1 erreur sur 100.',
    fond: '#E6F4EC',
    texte: '#2D7A50',
    point: '#49A673',
  },
  probable: {
    libelle: 'Probable',
    titre: 'Adresse probable',
    aide: 'Un DPE devance nettement les autres. Environ 6 erreurs sur 100 : un coup d’œil sur place confirme.',
    fond: '#FDF2DD',
    texte: '#8F6417',
    point: '#DFA23A',
  },
  a_verifier: {
    libelle: 'À vérifier',
    titre: 'Adresse à vérifier',
    aide: 'Plusieurs immeubles restent possibles : quand le DPE est publié, le bon est dans la liste 9 fois sur 10.',
    fond: '#EAF0FA',
    texte: '#46597E',
    point: '#7F95BF',
  },
  secteur: {
    libelle: 'En attente',
    titre: 'Adresse en attente',
    aide: 'Aucun DPE publié ne correspond encore : Priimo revérifie chaque nuit.',
    fond: '#F1F2F4',
    texte: '#5B6472',
    point: '#A3AAB5',
  },
};
