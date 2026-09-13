import { NextResponse } from 'next/server';
import { requireDirector } from '@/lib/auth/requireDirector';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { formaterEuros, lireConfigAbonnement } from '@/lib/billing/config';
import { motifRestriction, statutAbonnementDe } from '@/lib/billing/acces';
import { compterSiegesActifs, prixBaseDe, prixSiegeDe, siegesInclusDe, siegesSupplementaires } from '@/lib/billing/sieges';
import { stripeClient, stripeDisponible } from '@/lib/billing/stripe';

export const runtime = 'nodejs';

export async function GET() {
  const guard = await requireDirector();
  if (!guard.ok) return guard.response;

  const admin = createSupabaseAdminClient();
  const actifs = await compterSiegesActifs(admin, guard.agency.id);
  const inclus = siegesInclusDe(guard.agency);
  const extra = siegesSupplementaires(actifs, inclus);
  const prixBase = prixBaseDe(guard.agency);
  const prixSiege = prixSiegeDe(guard.agency);
  const montant = prixBase + extra * prixSiege;
  const config = lireConfigAbonnement();

  let prochaineEcheance: string | null = guard.agency.essai_fin_le ?? null;
  let factures: Array<{ id: string; date: string; montant: string; url: string | null; statut: string }> = [];

  if (stripeDisponible() && guard.agency.stripe_customer_id) {
    try {
      const stripe = stripeClient();
      if (guard.agency.stripe_subscription_id) {
        const sub = await stripe.subscriptions.retrieve(guard.agency.stripe_subscription_id);
        const fin =
          (sub as { current_period_end?: number }).current_period_end ??
          sub.items.data[0]?.current_period_end;
        if (fin) prochaineEcheance = new Date(fin * 1000).toISOString();
      }
      const invoices = await stripe.invoices.list({
        customer: guard.agency.stripe_customer_id,
        limit: 12,
      });
      factures = invoices.data.map((inv) => ({
        id: inv.id,
        date: new Date((inv.created ?? 0) * 1000).toISOString(),
        montant: formaterEuros((inv.amount_paid ?? 0) / 100),
        url: inv.hosted_invoice_url ?? null,
        statut: inv.status ?? 'open',
      }));
    } catch (err) {
      console.error('[abonnement] stripe', err);
    }
  }

  return NextResponse.json({
    statut: statutAbonnementDe(guard.agency),
    motif: motifRestriction(guard.agency),
    siegesActifs: actifs,
    siegesInclus: inclus,
    prixBase,
    prixSiege,
    montant,
    montantLibelle: formaterEuros(montant),
    prochaineEcheance,
    essaiJours: config.essaiJours,
    aUnClientStripe: Boolean(guard.agency.stripe_customer_id),
    factures,
  });
}
