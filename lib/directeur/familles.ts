import { compteursAgence, type JournalActivite } from '@/lib/activite/derive';
import type { Objectifs } from '@/lib/activite/objectifs';
import { nombreDeJours, type Intervalle } from '@/lib/activite/semaines';
import {
  FAMILLES_ACTIVITE,
  LIBELLE_ACTIVITE,
  PROVENANCE_ACTIVITE,
  SOURCE_PAR_ACTIVITE,
  type Compteur,
  type EtatSource,
} from '@/lib/activite/types';

/**
 * Les quatre familles d’activité de l’agence, sur la période affichée.
 *
 * Mêmes cartes que la semaine d’un collaborateur : la valeur est la somme
 * des compteurs, l’objectif est la somme des objectifs proratisée au nombre
 * de semaines que vaut la période.
 */
export function famillesAgence(input: {
  journal: JournalActivite;
  profileIds: readonly string[];
  objectifs: readonly Objectifs[];
  intervalle: Intervalle;
}): Compteur[] {
  const valeurs = compteursAgence({
    journal: input.journal,
    profileIds: input.profileIds,
    fenetre: input.intervalle,
  });
  const facteur = nombreDeJours(input.intervalle) / 7;

  const familles = FAMILLES_ACTIVITE.map((activite) => {
    const objectifHebdo = input.objectifs.reduce((somme, o) => somme + o.hebdo[activite], 0);
    const valeur = valeurs[activite];
    const etatSource: EtatSource = valeur > 0 ? 'ok' : 'muette';
    return {
      activite,
      libelle: LIBELLE_ACTIVITE[activite],
      valeur,
      objectif: Math.max(0, Math.round(objectifHebdo * facteur)),
      source: SOURCE_PAR_ACTIVITE[activite],
      provenance: PROVENANCE_ACTIVITE[activite],
      etatSource,
      ecartSemainePrecedente: null,
      tauxPassage: null as number | null,
      libelleSuivant: null as string | null,
    };
  });

  return familles.map((c, i, liste) => {
    const suivante = liste[i + 1];
    const suite = suivante && suivante.activite !== 'informations_terrain' ? suivante : undefined;
    if (!suite || c.valeur <= 0) return c;
    return {
      ...c,
      tauxPassage: Math.round((suite.valeur / c.valeur) * 1000) / 10,
      libelleSuivant: suite.libelle,
    };
  });
}
