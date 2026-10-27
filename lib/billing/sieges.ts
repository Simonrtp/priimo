import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { lireConfigAbonnement } from './config';
import type { AgencyBilling } from './acces';

type Admin = SupabaseClient<Database>;

export async function compterSiegesActifs(admin: Admin, agencyId: string): Promise<number> {
  const { count, error } = await admin
    .from('profile_agencies')
    .select('profile_id', { count: 'exact', head: true })
    .eq('agency_id', agencyId);
  if (error) {
    console.error('[billing] sieges', error.message);
    return 0;
  }
  return count ?? 0;
}

export function siegesInclusDe(agency: AgencyBilling | null | undefined): number {
  if (typeof agency?.sieges_inclus === 'number' && agency.sieges_inclus >= 0) {
    return agency.sieges_inclus;
  }
  return lireConfigAbonnement().siegesInclus;
}

export function prixSiegeDe(agency: AgencyBilling | null | undefined): number {
  if (typeof agency?.prix_siege_supplementaire === 'number' && agency.prix_siege_supplementaire >= 0) {
    return agency.prix_siege_supplementaire;
  }
  return lireConfigAbonnement().prixSiege;
}

export function prixBaseDe(agency: AgencyBilling | null | undefined): number {
  if (typeof agency?.prix_base === 'number' && agency.prix_base >= 0) {
    return agency.prix_base;
  }
  return lireConfigAbonnement().prixBase;
}

export function siegesSupplementaires(actifs: number, inclus: number): number {
  return Math.max(0, actifs - inclus);
}

/** Pour l’instant : invitations libres, aucun message ni confirmation. */
export function avertissementSiege(_params: {
  actifs: number;
  inclus: number;
}): string | null {
  return null;
}

/**
 * Sièges illimités pour l’instant : on n’aligne plus Stripe sur le nombre
 * de collaborateurs (pas de facturation ni de message au dépassement).
 */
export async function ajusterSiegesStripe(_params: {
  agency: AgencyBilling & { stripe_subscription_id?: string | null };
  siegesActifs: number;
}): Promise<void> {
  return;
}
