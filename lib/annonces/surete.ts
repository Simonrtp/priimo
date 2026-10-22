import type { Confiance } from './types';

/**
 * L'indice de sûreté d'une adresse d'annonce : Sûre, Probable, À vérifier, En attente.
 *
 * Taux mesurés au banc d'essai du 22/10/2026 : 140 DPE réels de Paris 10e, 11e,
 * 12e et 20e transformés en annonces SeLoger (conso chiffrée, quartier) et PAP
 * (lettres, rue, point approché), surfaces arrondies ou décalées comme sur les
 * portails, étage publié 85 fois sur 100. Deux cas : le DPE de l'annonce est
 * dans la base ADEME, ou pas encore (il est alors retiré de chaque réponse).
 *
 *   DPE publié      sûre 72/72 bonnes · probable 119/120 · liste « à vérifier » : bon immeuble dedans 97 %
 *   DPE pas publié  sûre 4/5           · probable 29/63
 *
 * Avec environ une annonce sur sept dont le DPE n'est pas encore publié :
 * moins de 1 % d'erreur en « sûre », environ 5 % en « probable ».
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
    aide: 'Le DPE de l’annonce désigne cet immeuble sans hésitation, ou le portail publie le numéro. Moins d’1 erreur sur 100.',
    fond: '#E6F4EC',
    texte: '#2D7A50',
    point: '#49A673',
  },
  probable: {
    libelle: 'Probable',
    titre: 'Adresse probable',
    aide: 'Un DPE devance nettement les autres. Environ 1 erreur sur 20 : un coup d’œil sur place confirme.',
    fond: '#FDF2DD',
    texte: '#8F6417',
    point: '#DFA23A',
  },
  a_verifier: {
    libelle: 'À vérifier',
    titre: 'Adresse à vérifier',
    aide: 'Plusieurs immeubles restent possibles : quand le DPE est publié, le bon est dans la liste 97 fois sur 100.',
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
