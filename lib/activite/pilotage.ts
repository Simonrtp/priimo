/**
 * Le pilotage d'une période : le bilan chiffré et la phrase qui le résume.
 *
 * Ce calcul est le seul que le sélecteur jour / semaine / mois / année fait
 * bouger. Il vit à part pour que changer de période n'oblige pas à refaire tout
 * l'écran Accueil — la page l'appelle au premier rendu, la route
 * `/api/dashboard/activite` le rappelle ensuite, et personne ne recharge les
 * leads, les biens, l'agenda ni les rapprochements pour trois compteurs.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { LeadStage } from '@/types/lead';
import { bilanPeriode, valeursDe, type BilanSemaine } from '@/lib/activite/bilan';
import { phrasePilotage, type PhrasePilotage } from '@/lib/activite/phrase';
import { FENETRE_SEMAINES } from '@/lib/activite/ratios';
import {
  dateDebut,
  fenetreSemaines,
  intervalleDe,
  intervalleDecale,
  intervalleSeptJours,
  moisDe,
  semaineDe,
  type Intervalle,
  type Periode,
} from '@/lib/activite/semaines';
import {
  fetchJournalActivite,
  fetchObjectifs,
  fetchReferenceMetier,
} from '@/lib/queries/activite';
import { parisYmd, ymdKey } from '@/lib/today/calendar';
import { DEMO_AGENCY_ID } from '@/lib/demo/constants';

type Client = SupabaseClient<Database>;

export type Pilotage = {
  bilan: BilanSemaine;
  phrase: PhrasePilotage;
};

/** L'ancre `?le=` n'est retenue que si elle a la forme d'un jour civil. */
export function ancreValide(brut: string | null | undefined): string | null {
  return brut && /^\d{4}-\d{2}-\d{2}$/.test(brut) ? brut : null;
}

/** L'intervalle affiché pour une période et une ancre éventuelle. */
export function intervalleAffiche(periode: Periode, ancre: string | null): Intervalle {
  const valide = ancreValide(ancre);
  return intervalleDe(periode, valide ? new Date(`${valide}T12:00:00Z`) : new Date());
}

/**
 * Le journal doit couvrir la période affichée, la précédente (pour l'écart), le
 * mois civil (objectif de mandats) et la fenêtre glissante des ratios.
 */
function couvertureJournal(periode: Periode, intervalle: Intervalle): Intervalle {
  const fenetreRatios = fenetreSemaines(semaineDe(dateDebut(intervalle)), FENETRE_SEMAINES);
  const mois = moisDe(dateDebut(intervalle));
  const precedente = intervalleDecale(periode, intervalle, -1);
  const aujourdhui = ymdKey(parisYmd(new Date()));
  const septJours = intervalleSeptJours(aujourdhui);
  const septChoisi = periode === 'jour' ? intervalleSeptJours(intervalle.fin) : null;
  return {
    debut: [
      fenetreRatios.debut,
      intervalle.debut,
      mois.debut,
      precedente.debut,
      septJours.debut,
      septChoisi?.debut,
    ]
      .filter((d): d is string => Boolean(d))
      .sort()[0]!,
    fin: [fenetreRatios.fin, intervalle.fin, mois.fin, septJours.fin, septChoisi?.fin]
      .filter((d): d is string => Boolean(d))
      .sort()
      .at(-1)!,
  };
}

export async function calculerPilotage(args: {
  supabase: Client;
  agencyId: string;
  /** Le collaborateur dont on lit l'activité — autorisation déjà vérifiée. */
  membreActivite: string;
  /** Tous les membres de l'agence, pour les moyennes de comparaison. */
  profileIdsAgence: readonly string[];
  stages: readonly LeadStage[];
  periode: Periode;
  ancre: string | null;
}): Promise<Pilotage> {
  const intervalle = intervalleAffiche(args.periode, args.ancre);

  const [journal, objectifs, reference] = await Promise.all([
    fetchJournalActivite({
      supabase: args.supabase,
      intervalle: couvertureJournal(args.periode, intervalle),
      stages: args.stages,
      // L'agence de démonstration montre son scénario ; partout ailleurs les
      // lignes fictives sont écartées du bilan.
      inclureDemo: args.agencyId === DEMO_AGENCY_ID,
    }),
    fetchObjectifs({ supabase: args.supabase, profileId: args.membreActivite }),
    fetchReferenceMetier({ supabase: args.supabase, agencyId: args.agencyId }),
  ]);

  const bilan = bilanPeriode({
    journal,
    profileId: args.membreActivite,
    profileIdsAgence: [...args.profileIdsAgence],
    periode: args.periode,
    intervalle,
    objectifs,
    reference: reference.reference,
    referenceFournie: reference.fournie,
  });

  const phrase = phrasePilotage({
    compteurs: valeursDe(bilan),
    objectifMandatsMois: bilan.mandatsDuMois.objectif,
    ratios: bilan.ratios,
    periode: args.periode,
    intervalle,
    semaine1: bilan.semaine1,
    etatsSource: bilan.etatsSource,
    // Une période révolue se juge entière ; la période en cours se proratise.
    jourCourant: ymdKey(parisYmd(new Date())),
  });

  return { bilan, phrase };
}
