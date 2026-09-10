import type { ReferenceMetier } from './ratios';
import {
  ACTIVITES,
  FAMILLES_ACTIVITE,
  type Activite,
  type FamilleActivite,
} from './types';

/**
 * Objectifs et référence métier.
 *
 * Les valeurs ci-dessous sont PROVISOIRES et le code doit le dire à l'écran.
 * Elles tiennent la place des chiffres réels du réseau, que Nicolas doit
 * fournir depuis ses quatre agences. Un directeur repère immédiatement un
 * objectif inventé ; autant l'annoncer avant qu'il le demande.
 */

export const OBJECTIFS_PAR_DEFAUT_PROVISOIRES = true;

/** Objectifs hebdomadaires proposés à la création d'un compte. */
export const OBJECTIFS_HEBDO_PAR_DEFAUT: Record<Activite, number> = {
  contacts_physiques: 50,
  immeubles_prospectes: 30,
  contacts_qualifies: 10,
  estimations: 3,
  informations_terrain: 10,
  mandats: 1,
};

/** Objectif mensuel de mandats. Le seul objectif qui ne soit pas hebdomadaire. */
export const OBJECTIF_MANDATS_MENSUEL_PAR_DEFAUT = 3;

/**
 * Référence métier de dernier recours, quand `agency_activity_settings` est
 * vide. Sert de garde-fou pour que l'écran ne montre jamais un tiret, mais il
 * doit toujours s'accompagner du libellé « en attendant mes chiffres ».
 */
export const REFERENCE_METIER_PROVISOIRE: ReferenceMetier = {
  physiquesParQualifie: 8,
  qualifiesParEstimation: 3,
  estimationsParMandat: 3,
};

export type Periode = 'hebdo' | 'mensuel';

/** Une ligne de `activity_goals`, aplatie. */
export type ObjectifRow = {
  activite: string;
  periode: string;
  cible: number;
};

export type Objectifs = {
  hebdo: Record<Activite, number>;
  mandatsMensuel: number;
  /** `true` si aucun objectif n'a été posé par le directeur. */
  parDefaut: boolean;
};

function estActivite(valeur: string): valeur is Activite {
  return (ACTIVITES as readonly string[]).includes(valeur);
}

/**
 * Fusionne les objectifs enregistrés avec les défauts.
 *
 * Une ligne absente n'est pas une erreur : c'est le cas normal d'un compte
 * qui vient d'être créé. Ça évite de semer six lignes à chaque inscription et
 * de devoir les migrer le jour où le réseau change ses repères.
 */
export function objectifsEffectifs(rows: readonly ObjectifRow[]): Objectifs {
  const hebdo = { ...OBJECTIFS_HEBDO_PAR_DEFAUT };
  let mandatsMensuel = OBJECTIF_MANDATS_MENSUEL_PAR_DEFAUT;
  let posePar = 0;

  for (const row of rows) {
    if (!estActivite(row.activite)) continue;
    if (!Number.isFinite(row.cible) || row.cible < 0) continue;

    if (row.periode === 'hebdo') {
      hebdo[row.activite] = row.cible;
      posePar += 1;
    } else if (row.periode === 'mensuel' && row.activite === 'mandats') {
      mandatsMensuel = row.cible;
      posePar += 1;
    }
  }

  return { hebdo, mandatsMensuel, parDefaut: posePar === 0 };
}

/** Borne haute de saisie, alignée sur `activity_goals_cible_check`. */
export const OBJECTIF_MAX = 10_000;

/**
 * Les objectifs tels qu'on les saisit à l'écran : les cinq familles à la
 * semaine, les mandats au mois. C'est exactement ce que la carte affiche.
 *
 * L'objectif hebdomadaire de mandats n'y est pas et ne doit pas y entrer : il
 * sert aux ratios, pas au pilotage de la semaine, et le proposer à côté de
 * l'objectif mensuel ferait deux chiffres pour la même chose.
 */
export type ObjectifsSaisis = {
  hebdo: Record<FamilleActivite, number>;
  mandatsMensuel: number;
};

/**
 * Les quatre cadences sous lesquelles un objectif hebdomadaire se lit. Mêmes
 * valeurs que la granularité du sélecteur de l'Accueil, pour que « 50 par
 * semaine » et la carte de la semaine parlent du même chiffre.
 */
export type Cadence = 'jour' | 'semaine' | 'mois' | 'annee';

/**
 * Jours civils que vaut une cadence. Le mois et l'année sont des moyennes :
 * l'écran, lui, proratise sur le nombre de jours réel de la période affichée,
 * donc un mois court peut afficher un objectif d'un ou deux points en dessous.
 */
const JOURS_PAR_CADENCE: Record<Cadence, number> = {
  jour: 1,
  semaine: 7,
  mois: 365 / 12,
  annee: 365,
};

/** Un objectif hebdomadaire, lu à une autre cadence. */
export function objectifACadence(hebdo: number, cadence: Cadence): number {
  return Math.max(0, Math.round((hebdo * JOURS_PAR_CADENCE[cadence]) / 7));
}

/** L'inverse : ce que vaut à la semaine un chiffre saisi à une autre cadence. */
export function objectifDepuisCadence(valeur: number, cadence: Cadence): number {
  return Math.max(
    0,
    Math.min(OBJECTIF_MAX, Math.round((valeur * 7) / JOURS_PAR_CADENCE[cadence])),
  );
}

/** Ce que le formulaire affiche à l'ouverture. */
export function saisieDepuisObjectifs(objectifs: Objectifs): ObjectifsSaisis {
  const hebdo = {} as Record<FamilleActivite, number>;
  for (const famille of FAMILLES_ACTIVITE) hebdo[famille] = objectifs.hebdo[famille];
  return { hebdo, mandatsMensuel: objectifs.mandatsMensuel };
}

function cibleValide(valeur: unknown): number | null {
  const n = typeof valeur === 'number' ? valeur : Number.NaN;
  if (!Number.isInteger(n) || n < 0 || n > OBJECTIF_MAX) return null;
  return n;
}

/**
 * Lecture d'un corps de requête. Tout ou rien : une seule cible hors bornes et
 * l'enregistrement est refusé en entier, sinon un objectif rejeté passerait
 * inaperçu au milieu de cinq acceptés.
 */
export function parseObjectifsSaisis(entree: unknown): ObjectifsSaisis | null {
  if (typeof entree !== 'object' || entree === null) return null;
  const brut = entree as { hebdo?: unknown; mandatsMensuel?: unknown };
  if (typeof brut.hebdo !== 'object' || brut.hebdo === null) return null;

  const source = brut.hebdo as Record<string, unknown>;
  const hebdo = {} as Record<FamilleActivite, number>;
  for (const famille of FAMILLES_ACTIVITE) {
    const cible = cibleValide(source[famille]);
    if (cible === null) return null;
    hebdo[famille] = cible;
  }

  const mandatsMensuel = cibleValide(brut.mandatsMensuel);
  if (mandatsMensuel === null) return null;

  return { hebdo, mandatsMensuel };
}

/**
 * Les lignes à écrire dans `activity_goals`. L'objectif hebdomadaire de mandats
 * n'est pas de la partie : il n'est pas saisi, donc il n'est pas réécrit.
 */
export function lignesObjectifs(
  saisie: ObjectifsSaisis,
): { activite: Activite; periode: Periode; cible: number }[] {
  return [
    ...FAMILLES_ACTIVITE.map((famille) => ({
      activite: famille as Activite,
      periode: 'hebdo' as Periode,
      cible: saisie.hebdo[famille],
    })),
    { activite: 'mandats' as Activite, periode: 'mensuel' as Periode, cible: saisie.mandatsMensuel },
  ];
}

/** Une ligne de `agency_activity_settings`, aplatie. */
export type ReferenceRow = {
  physiques_par_qualifie: number | string | null;
  qualifies_par_estimation: number | string | null;
  estimations_par_mandat: number | string | null;
};

function nombre(valeur: number | string | null): number | null {
  if (valeur === null) return null;
  const n = typeof valeur === 'number' ? valeur : Number.parseFloat(valeur);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Référence métier de l'agence. `fournie` est faux tant qu'aucun des trois
 * ratios n'est renseigné — c'est ce booléen qui déclenche le libellé
 * « en attendant mes chiffres ».
 */
export function referenceMetier(row: ReferenceRow | null): {
  reference: ReferenceMetier;
  fournie: boolean;
} {
  const physiquesParQualifie = nombre(row?.physiques_par_qualifie ?? null);
  const qualifiesParEstimation = nombre(row?.qualifies_par_estimation ?? null);
  const estimationsParMandat = nombre(row?.estimations_par_mandat ?? null);
  const fournie =
    physiquesParQualifie !== null ||
    qualifiesParEstimation !== null ||
    estimationsParMandat !== null;

  if (!fournie) {
    return { reference: { ...REFERENCE_METIER_PROVISOIRE }, fournie: false };
  }

  return {
    reference: {
      physiquesParQualifie:
        physiquesParQualifie ?? REFERENCE_METIER_PROVISOIRE.physiquesParQualifie,
      qualifiesParEstimation:
        qualifiesParEstimation ?? REFERENCE_METIER_PROVISOIRE.qualifiesParEstimation,
      estimationsParMandat:
        estimationsParMandat ?? REFERENCE_METIER_PROVISOIRE.estimationsParMandat,
    },
    fournie: true,
  };
}
