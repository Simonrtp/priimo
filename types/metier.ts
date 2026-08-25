/** Types métier — mandats, visites, offres, promesses, rendez-vous. */

export type MandatType = 'simple' | 'exclusif' | 'semi_exclusif';
export type VisiteInteret = 'aucun' | 'tiede' | 'chaud' | 'offre';
export type OffreStatut = 'en_attente' | 'acceptee' | 'refusee';
export type PromesseStatut = 'a_faire' | 'faite' | 'reportee';
export type PromesseCreePar = 'dictee' | 'manuel';
export type RendezVousType = 'visite' | 'estimation' | 'signature' | 'autre';
export type RendezVousCreePar = 'dictee' | 'fiche_bien' | 'manuel';

export type TodayBienMetier = {
  id: string;
  address: string;
  mandatType: MandatType | null;
  mandatSigneLe: string | null;
  mandatDureeMois: number;
  mandatStatut: string;
  price: number | null;
  latitude: number | null;
  longitude: number | null;
  visitCount: number;
};

export type TodayVisite = {
  id: string;
  bienId: string;
  bienAddress: string;
  contactId: string | null;
  contactName: string | null;
  contactPhone: string | null;
  dateVisite: string;
  compteRenduAcquereurFaitLe: string | null;
  compteRenduVendeurFaitLe: string | null;
  proprietaireContactId: string | null;
  proprietaireName: string | null;
  proprietairePhone: string | null;
};

export type TodayOffre = {
  id: string;
  bienId: string;
  bienAddress: string;
  contactId: string | null;
  contactName: string | null;
  montant: number;
  validiteJusquAu: string | null;
  financementEcheance: string | null;
  compromisSigneLe: string | null;
  preemptionPurgeeLe: string | null;
  statut: OffreStatut;
};

export type TodayPromesse = {
  id: string;
  profileId: string;
  contactId: string | null;
  contactName: string | null;
  contactPhone: string | null;
  intitule: string;
  echeance: string;
  statut: PromesseStatut;
};

export type TodayRendezVous = {
  id: string;
  profileId: string;
  contactId: string | null;
  contactName: string | null;
  contactPhone: string | null;
  bienId: string | null;
  bienAddress: string | null;
  debut: string;
  fin: string;
  type: RendezVousType;
  lieu: string | null;
};
