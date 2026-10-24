import { DIRECTEUR_SEUILS } from './config';

export type IndicateursAgence = {
  mandatsEnStock: number;
  tauxExclusivite: number | null;
  mandatsPlusDe60j: number;
  contactsParMandat: number | null;
  mandatsDuMois: number;
  objectifMandatsMois: number;
};

export type VictoireContact = {
  /** Fiche contact, absente quand le nom vient seulement du lead ou du bien. */
  id: string | null;
  nom: string;
  telephone: string | null;
  email: string | null;
  role: string | null;
};

export type VictoireBien = {
  /** Fiche bien, absente quand les précisions viennent seulement du lead. */
  id: string | null;
  precisions: string | null;
  /** Prix de la fiche bien, s'il existe. */
  prix: string | null;
  /** Prix d'achat du lead, seulement s'il est affiché ailleurs comme fiable. */
  achat: string | null;
  mandat: string | null;
};

export type VictoireSemaine = {
  kind: 'mandat' | 'rendez_vous';
  prenom: string;
  label: string;
  /** ISO de la transition. Absent sur les jeux d'aperçu. */
  quand?: string;
  leadId?: string | null;
  adresse?: string | null;
  contacts?: readonly VictoireContact[];
  bien?: VictoireBien | null;
};

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
