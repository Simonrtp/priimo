/**
 * Les compteurs d'activité terrain.
 *
 * Chaque compteur porte sa source. Un compteur dérivé est vrai par
 * construction : il se relit des journaux, personne ne le saisit.
 *
 * Une note d'échange compte comme les autres notes terrain.
 */

export const ACTIVITES = [
  'immeubles_prospectes',
  'contacts_qualifies',
  'estimations',
  'informations_terrain',
  'mandats',
] as const;

export type Activite = (typeof ACTIVITES)[number];

/**
 * L'entonnoir de prospection, puis les notes. Les mandats se pilotent
 * au mois, à part.
 *
 * Ordre = cascade : immeubles → qualifiés → estimations, puis Notes terrain.
 */
export const FAMILLES_ACTIVITE = [
  'immeubles_prospectes',
  'contacts_qualifies',
  'estimations',
  'informations_terrain',
] as const satisfies readonly Activite[];

export type FamilleActivite = (typeof FAMILLES_ACTIVITE)[number];

export type SourceCompteur = 'derive' | 'declare';

export const SOURCE_PAR_ACTIVITE: Record<Activite, SourceCompteur> = {
  immeubles_prospectes: 'derive',
  contacts_qualifies: 'derive',
  estimations: 'derive',
  informations_terrain: 'derive',
  mandats: 'derive',
};

export const LIBELLE_ACTIVITE: Record<Activite, string> = {
  immeubles_prospectes: 'Immeubles travaillés',
  contacts_qualifies: 'Contacts qualifiés',
  estimations: 'Estimations',
  informations_terrain: 'Notes terrain',
  mandats: 'Mandats signés',
};

/**
 * D'où vient le chiffre, en langage d'agence. L'écran Accueil affiche ça en
 * info-bulle : un agent ne fait confiance qu'à un compteur dont il comprend
 * la fabrication.
 */
export const PROVENANCE_ACTIVITE: Record<Activite, string> = {
  immeubles_prospectes:
    'Compté à partir des adresses passées en sortie (vu, absent, rencontré) et des notes rattachées. Un immeuble visité deux fois ne compte qu’une fois.',
  contacts_qualifies:
    'Compté à partir des leads que j’ai passés à l’étape « Contacté » dans mon pipeline cette semaine.',
  estimations:
    'Compté à partir des leads que j’ai passés à l’étape « Estimation » dans mon pipeline cette semaine.',
  informations_terrain:
    'Compté à partir des notes : une note rattachée à une adresse, ou une note qui nomme une personne.',
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
  immeubles_prospectes:
    'Une adresse passée en sortie ou une note rattachée, et ce compteur démarre.',
  informations_terrain:
    'Une note rattachée au terrain, et ce compteur démarre.',
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
  /** Taux de passage vers la carte suivante, en %. `null` sur la dernière. */
  tauxPassage: number | null;
  /** Libellé de la carte suivante, pour dire vers quoi passe le taux. */
  libelleSuivant: string | null;
};

export function compteurVide(): Record<Activite, number> {
  return {
    immeubles_prospectes: 0,
    contacts_qualifies: 0,
    estimations: 0,
    informations_terrain: 0,
    mandats: 0,
  };
}
