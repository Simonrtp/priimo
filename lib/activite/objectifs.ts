import type { ReferenceMetier } from './ratios';
import { ACTIVITES, type Activite } from './types';

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
 * doit toujours s'accompagner du libellé « en attendant vos chiffres ».
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
 * « en attendant vos chiffres ».
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
