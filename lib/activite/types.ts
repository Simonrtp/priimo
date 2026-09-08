/**
 * Les six compteurs d'activité terrain.
 *
 * Chaque compteur porte sa source. Un compteur dérivé est vrai par
 * construction : il se relit des journaux, personne ne le saisit. Un compteur
 * déclaré est une promesse que l'agent fait, et il n'y en a qu'un — au-delà,
 * la donnée pourrit.
 */

export const ACTIVITES = [
  'contacts_physiques',
  'immeubles_prospectes',
  'contacts_qualifies',
  'estimations',
  'informations_terrain',
  'mandats',
] as const;

export type Activite = (typeof ACTIVITES)[number];

/**
 * Les cinq familles affichées en cartes égales sur l'Accueil. Les mandats en
 * sont exclus : ils se pilotent au mois, pas à la semaine, et les mêler aux
 * cinq autres ferait un sixième bloc à zéro pendant des semaines.
 */
export const FAMILLES_ACTIVITE = [
  'contacts_physiques',
  'immeubles_prospectes',
  'contacts_qualifies',
  'estimations',
  'informations_terrain',
] as const satisfies readonly Activite[];

export type FamilleActivite = (typeof FAMILLES_ACTIVITE)[number];

export type SourceCompteur = 'derive' | 'declare';

export const SOURCE_PAR_ACTIVITE: Record<Activite, SourceCompteur> = {
  contacts_physiques: 'declare',
  immeubles_prospectes: 'derive',
  contacts_qualifies: 'derive',
  estimations: 'derive',
  informations_terrain: 'derive',
  mandats: 'derive',
};

export const LIBELLE_ACTIVITE: Record<Activite, string> = {
  contacts_physiques: 'Contacts physiques',
  immeubles_prospectes: 'Immeubles prospectés',
  contacts_qualifies: 'Contacts qualifiés',
  estimations: 'Estimations',
  informations_terrain: 'Informations terrain',
  mandats: 'Mandats signés',
};

/**
 * D'où vient le chiffre, en langage d'agence. L'écran Accueil affiche ça en
 * info-bulle : un agent ne fait confiance qu'à un compteur dont il comprend
 * la fabrication.
 */
export const PROVENANCE_ACTIVITE: Record<Activite, string> = {
  contacts_physiques:
    'Compté à partir des personnes que j’ai marquées « rencontrée » pendant mes sorties. C’est le seul chiffre que je déclare moi-même.',
  immeubles_prospectes:
    'Compté à partir des immeubles où j’ai laissé une note, pris un lead ou rencontré quelqu’un cette semaine. Un immeuble visité deux fois ne compte qu’une fois.',
  contacts_qualifies:
    'Compté à partir des leads que j’ai passés à l’étape « Contacté » dans mon pipeline cette semaine.',
  estimations:
    'Compté à partir des leads que j’ai passés à l’étape « Estimation » dans mon pipeline cette semaine.',
  informations_terrain:
    'Compté à partir de mes notes vocales rattachées à un immeuble ou à une parcelle.',
  mandats:
    'Compté à partir des leads que j’ai passés à l’étape « Mandat signé » dans mon pipeline cette semaine.',
};

/**
 * État de la source derrière un compteur.
 *
 * `muette` et `indisponible` valent toutes deux zéro à l'écran, mais ne se
 * disent pas pareil : l'une demande de sortir prospecter, l'autre demande
 * d'appeler le support. Les confondre, c'est apprendre à l'agent à ignorer
 * ses propres zéros.
 */
export type EtatSource = 'ok' | 'muette' | 'indisponible';

export const PHRASE_ETAT_SOURCE: Record<Exclude<EtatSource, 'ok'>, string> = {
  muette: 'En attente des premières sorties',
  indisponible: 'Chiffre indisponible pour le moment',
};

/** Phrase quand la source n’a encore rien produit — une consigne, pas un vide. */
export const PHRASE_SOURCE_MUETTE: Partial<Record<Activite, string>> = {
  informations_terrain:
    'Une note vocale ou écrite sur le terrain, et ce compteur démarre.',
};

export function phraseEtatSource(activite: Activite, etat: Exclude<EtatSource, 'ok'>): string {
  if (etat === 'muette') return PHRASE_SOURCE_MUETTE[activite] ?? PHRASE_ETAT_SOURCE.muette;
  return PHRASE_ETAT_SOURCE.indisponible;
}

export type Compteur = {
  activite: Activite;
  libelle: string;
  valeur: number;
  objectif: number;
  source: SourceCompteur;
  provenance: string;
  etatSource: EtatSource;
  /** Écart avec la même semaine décalée d'une semaine. `null` si pas d'historique. */
  ecartSemainePrecedente: number | null;
};

export function compteurVide(): Record<Activite, number> {
  return {
    contacts_physiques: 0,
    immeubles_prospectes: 0,
    contacts_qualifies: 0,
    estimations: 0,
    informations_terrain: 0,
    mandats: 0,
  };
}
