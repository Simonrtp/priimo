/**
 * Plafond du contexte envoyé au modèle. C'est le nombre de tokens qui est
 * facturé, pas le nombre d'appels : 20 lignes, champs texte coupés à 200
 * caractères.
 */

import type { CollecteLigne, CollecteResult } from './collecte';

export const MAX_LIGNES_MODELE = 20;
export const MAX_CHAMP_CHARS = 200;

function tronquer(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.length > MAX_CHAMP_CHARS ? `${value.slice(0, MAX_CHAMP_CHARS)}…` : value;
  }
  if (Array.isArray(value)) return value.slice(0, 10).map(tronquer);
  return value;
}

function ligneBornee(ligne: CollecteLigne): Record<string, unknown> {
  const faits: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(ligne.faits)) {
    if (value === null || value === undefined || value === '') continue;
    faits[key] = tronquer(value);
  }
  return { type: ligne.kind, date: ligne.date, auteur: ligne.auteur, ...faits };
}

export type PayloadBorne = {
  payload: Record<string, unknown>;
  /** Lignes réellement envoyées. */
  envoyees: number;
  /** Lignes écartées faute de place — jamais silencieusement. */
  omises: number;
};

/**
 * Les lignes sont déjà triées par pertinence par la collecte : on garde les
 * premières et on annonce combien ont été laissées de côté.
 */
export function payloadBorne(collecte: CollecteResult): PayloadBorne {
  const gardees = collecte.lignes.slice(0, MAX_LIGNES_MODELE);
  const omises = collecte.lignes.length - gardees.length;
  return {
    envoyees: gardees.length,
    omises,
    payload: {
      recherche: {
        type: collecte.type,
        libelle: collecte.cherche,
        par_texte: collecte.rechercheParTexte,
      },
      agregats: collecte.agregats,
      lignes_total: collecte.lignes.length,
      lignes: gardees.map(ligneBornee),
    },
  };
}
