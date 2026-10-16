import { COULEUR_FAMILLE, GRIS_NEUTRE, ROUGE_ALERTE } from '@/lib/activite/couleurs';
import { FIELD } from '@/lib/today/field';
import type { DirecteurCarteType } from '@/lib/directeur/cartes';
import type { StatutNegociateur } from '@/lib/directeur/statut';

/** Violet objectif — mêmes paliers que BandeauObjectif Accueil agent. */
export const OBJECTIF = {
  teinte: '#7C4DD3',
  pastelFort: '#DCCFF7',
  pastille: '#EBE3FA',
  voile: '#F5F1FD',
} as const;

/** Le statut d'un négociateur, par rapport à son propre rythme. */
export const STATUT_STYLE: Record<
  StatutNegociateur,
  { fond: string; texte: string; barre: string; avatar: string }
> = {
  en_avance: {
    fond: COULEUR_FAMILLE.contacts_qualifies.pastelFort,
    texte: COULEUR_FAMILLE.contacts_qualifies.teinte,
    barre: COULEUR_FAMILLE.contacts_qualifies.teinte,
    avatar: COULEUR_FAMILLE.contacts_qualifies.pastille,
  },
  dans_le_rythme: {
    fond: '#D6DEE8',
    texte: '#3A4A66',
    barre: '#5B6B86',
    avatar: '#E8EEF5',
  },
  a_voir: {
    fond: 'rgba(232, 116, 60, 0.18)',
    texte: '#C45D2A',
    barre: FIELD.orange,
    avatar: '#FFE0C4',
  },
  nouveau: {
    fond: OBJECTIF.pastelFort,
    texte: OBJECTIF.teinte,
    barre: OBJECTIF.teinte,
    avatar: OBJECTIF.pastille,
  },
};

/** Une alerte « à traiter » : son nom court et sa couleur. */
export const ALERTE_STYLE: Record<
  DirecteurCarteType,
  { label: string; teinte: string; pastel: string; voile: string }
> = {
  mandat_fin_validite: {
    label: 'Fin de mandat',
    teinte: ROUGE_ALERTE.teinte,
    pastel: ROUGE_ALERTE.pastelFort,
    voile: ROUGE_ALERTE.voile,
  },
  decrochage: {
    label: 'Décrochage',
    teinte: COULEUR_FAMILLE.immeubles_prospectes.teinte,
    pastel: COULEUR_FAMILLE.immeubles_prospectes.pastelFort,
    voile: COULEUR_FAMILLE.immeubles_prospectes.voile,
  },
  estimation_sans_relance: {
    label: 'Estimation',
    teinte: COULEUR_FAMILLE.estimations.teinte,
    pastel: COULEUR_FAMILLE.estimations.pastelFort,
    voile: COULEUR_FAMILLE.estimations.voile,
  },
  mandat_vieillit: {
    label: 'Mandat',
    teinte: '#C45D2A',
    pastel: FIELD.orangePastel,
    voile: '#FFF4EC',
  },
  prospects_sans_negociateur: {
    label: 'Prospection',
    teinte: GRIS_NEUTRE.teinte,
    pastel: GRIS_NEUTRE.pastelFort,
    voile: GRIS_NEUTRE.voile,
  },
};
