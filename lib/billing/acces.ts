import type { AgencyRow, StatutAbonnement } from '@/types/database';

export type AgencyBilling = Partial<
  Pick<
    AgencyRow,
    | 'statut_abonnement'
    | 'essai_fin_le'
    | 'sieges_inclus'
    | 'prix_base'
    | 'prix_siege_supplementaire'
    | 'stripe_customer_id'
    | 'stripe_subscription_id'
    | 'demande_decision'
  >
>;

export function statutAbonnementDe(agency: AgencyBilling | null | undefined): StatutAbonnement {
  return agency?.statut_abonnement ?? 'actif';
}

export function essaiExpire(agency: AgencyBilling | null | undefined, now = new Date()): boolean {
  if (statutAbonnementDe(agency) !== 'essai') return false;
  const fin = agency?.essai_fin_le;
  if (!fin) return false;
  const t = Date.parse(fin);
  return Number.isFinite(t) && t <= now.getTime();
}

/** Demande d’inscription pas encore activée (ou refusée). */
export function estEnAttente(agency: AgencyBilling | null | undefined): boolean {
  return statutAbonnementDe(agency) === 'en_attente';
}

/**
 * Lecture des données de l’agence : toujours ouverte.
 * On ne coupe jamais l’accès à ce qui lui appartient.
 */
export function lectureOuverte(_agency: AgencyBilling | null | undefined): true {
  return true;
}

/**
 * Livraison du lundi, estimation, captation.
 * Fermé en attente, après essai sans paiement, impayé ou résilié.
 */
export function productionOuverte(
  agency: AgencyBilling | null | undefined,
  now = new Date(),
): boolean {
  const statut = statutAbonnementDe(agency);
  if (statut === 'en_attente' || statut === 'impaye' || statut === 'resilie') return false;
  if (statut === 'essai') return !essaiExpire(agency, now);
  return statut === 'actif';
}

export function peutLivrerLeads(agency: AgencyBilling | null | undefined, now = new Date()): boolean {
  return productionOuverte(agency, now);
}

export function peutEstimer(agency: AgencyBilling | null | undefined, now = new Date()): boolean {
  return productionOuverte(agency, now);
}

export function peutCapturerLeads(
  agency: AgencyBilling | null | undefined,
  now = new Date(),
): boolean {
  return productionOuverte(agency, now);
}

export function abonnementRestreint(
  agency: AgencyBilling | null | undefined,
  now = new Date(),
): boolean {
  return !productionOuverte(agency, now);
}

export function motifRestriction(
  agency: AgencyBilling | null | undefined,
  now = new Date(),
): 'en_attente' | 'refusee' | 'essai' | 'impaye' | 'resilie' | null {
  if (!abonnementRestreint(agency, now)) return null;
  if (estEnAttente(agency)) {
    return agency?.demande_decision === 'refusee' ? 'refusee' : 'en_attente';
  }
  if (essaiExpire(agency, now) || statutAbonnementDe(agency) === 'essai') return 'essai';
  if (statutAbonnementDe(agency) === 'resilie') return 'resilie';
  return 'impaye';
}
