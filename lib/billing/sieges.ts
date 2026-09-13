import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { formaterEuros, lireConfigAbonnement } from './config';
import type { AgencyBilling } from './acces';
import { stripeClient, stripeDisponible } from './stripe';

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

export function avertissementSiege(params: {
  actifs: number;
  inclus: number;
  prixSiege: number;
}): string | null {
  const prochain = params.actifs + 1;
  if (prochain <= params.inclus) return null;
  const rang = `${prochain}e`;
  return `Ce collaborateur est le ${rang}. Il sera facturé ${formaterEuros(params.prixSiege)} par mois en plus, au prorata du mois en cours.`;
}

/**
 * Aligne la quantité Stripe des sièges extra.
 * À la hausse : prorata. À la baisse : cycle suivant, jamais rétroactif.
 */
export async function ajusterSiegesStripe(params: {
  agency: AgencyBilling & { stripe_subscription_id?: string | null };
  siegesActifs: number;
}): Promise<void> {
  if (!stripeDisponible()) return;
  const subscriptionId = params.agency.stripe_subscription_id?.trim();
  if (!subscriptionId) return;

  const extra = siegesSupplementaires(params.siegesActifs, siegesInclusDe(params.agency));
  const stripe = stripeClient();
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const extraItem = sub.items.data.find((item) => item.metadata?.priimo === 'siege');
  const actuel = extraItem?.quantity ?? 0;
  if (actuel === extra && extraItem) return;

  if (extra === 0) {
    if (extraItem) {
      await stripe.subscriptionItems.del(extraItem.id, { proration_behavior: 'none' });
    }
    return;
  }

  if (extraItem) {
    await stripe.subscriptionItems.update(extraItem.id, {
      quantity: extra,
      proration_behavior: extra > actuel ? 'create_prorations' : 'none',
    });
    return;
  }

  const priceId = process.env.STRIPE_PRICE_SIEGE?.trim();
  if (!priceId) {
    console.error('[billing] STRIPE_PRICE_SIEGE manquant, siège extra non poussé.');
    return;
  }
  await stripe.subscriptionItems.create({
    subscription: subscriptionId,
    price: priceId,
    quantity: extra,
    proration_behavior: 'create_prorations',
    metadata: { priimo: 'siege' },
  });
}
