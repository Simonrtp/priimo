/**
 * Le panneau assistant n'est pas une vue de liste. Au-delà de cinq lignes,
 * il montre les cinq premières et renvoie vers l'écran qui sait vraiment
 * afficher le reste, déjà filtré.
 */

import type { CollecteResult } from './collecte';
import type { AssistantIntent } from './intent';

/** Au-delà, on renvoie vers l'écran plutôt que de dérouler dans le panneau. */
export const LIGNES_AVANT_RENVOI = 5;

export type VoirTout = {
  href: string;
  total: number;
};

function param(valeur: string): string {
  return encodeURIComponent(valeur.trim());
}

/**
 * Écran capable d'afficher la suite, avec le filtre correspondant à la
 * question. Null quand aucun écran ne reprend ce filtre : mieux vaut pas de
 * lien qu'un lien qui montre autre chose.
 */
export function listeVersEcran(
  intent: AssistantIntent,
  collecte: Pick<CollecteResult, 'lignes'>,
): VoirTout | null {
  const total = collecte.lignes.length;
  if (total <= LIGNES_AVANT_RENVOI) return null;

  if (intent.type === 'immeuble' && intent.adresse) {
    return { href: `/dashboard/prospection?q=${param(intent.adresse)}&vue=liste`, total };
  }
  if (intent.type === 'personne' && intent.nom) {
    return { href: `/dashboard/contacts?q=${param(intent.nom)}`, total };
  }
  if (intent.type === 'recherche_acquereur') {
    const filtre = intent.code_postal ? `&q=${param(intent.code_postal)}` : '';
    return { href: `/dashboard/contacts?type=acquereur${filtre}`, total };
  }
  if (intent.type === 'activite') {
    return { href: '/dashboard', total };
  }
  return null;
}
