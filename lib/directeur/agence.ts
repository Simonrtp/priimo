import { DIRECTEUR_SEUILS } from './config';

export type IndicateursAgence = {
  mandatsEnStock: number;
  tauxExclusivite: number | null;
  mandatsPlusDe60j: number;
  contactsParMandat: number | null;
  mandatsDuMois: number;
  objectifMandatsMois: number;
};

export type VictoireSemaine =
  | { kind: 'mandat'; prenom: string; label: string }
  | { kind: 'rendez_vous'; prenom: string; label: string };

export function indicateursAgence(input: {
  mandatsActifs: number;
  mandatsExclusifs: number;
  mandatsPlusDe60j: number;
  contactsPhysiquesFenetre: number;
  mandatsFenetre: number;
  mandatsDuMois: number;
  objectifMandatsMois: number;
}): IndicateursAgence {
  const taux =
    input.mandatsActifs > 0
      ? Math.round((input.mandatsExclusifs / input.mandatsActifs) * 100)
      : null;
  const contactsParMandat =
    input.mandatsFenetre > 0
      ? Math.round((input.contactsPhysiquesFenetre / input.mandatsFenetre) * 10) / 10
      : null;
  return {
    mandatsEnStock: input.mandatsActifs,
    tauxExclusivite: taux,
    mandatsPlusDe60j: input.mandatsPlusDe60j,
    contactsParMandat,
    mandatsDuMois: input.mandatsDuMois,
    objectifMandatsMois: input.objectifMandatsMois,
  };
}

export function progressionObjectifEquipe(mandats: number, objectif: number): number {
  if (objectif <= 0) return 0;
  return Math.min(100, Math.round((mandats / objectif) * 100));
}

export { DIRECTEUR_SEUILS };
