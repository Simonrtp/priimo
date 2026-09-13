import { NextResponse } from 'next/server';
import { requireDirector } from '@/lib/auth/requireDirector';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { eurosVersCents, lireConfigAbonnement } from '@/lib/billing/config';
import { estEnAttente } from '@/lib/billing/acces';
import { prixBaseDe } from '@/lib/billing/sieges';
import { stripeClient, stripeDisponible } from '@/lib/billing/stripe';

export const runtime = 'nodejs';

export async function POST() {
  const guard = await requireDirector();
  if (!guard.ok) return guard.response;
  if (!stripeDisponible()) {
    return NextResponse.json({ error: 'Paiement non configuré.' }, { status: 503 });
  }
  if (estEnAttente(guard.agency)) {
    return NextResponse.json(
      { error: 'L’agence n’est pas encore activée.' },
      { status: 403 },
    );
  }

  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  const stripe = stripeClient();
  const admin = createSupabaseAdminClient();
  const agency = guard.agency;
  const config = lireConfigAbonnement();

  let customerId = agency.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: guard.user.email,
      name: agency.name,
      metadata: { agency_id: agency.id },
    });
    customerId = customer.id;
    await admin.from('agencies').update({ stripe_customer_id: customerId }).eq('id', agency.id);
  }

  const priceId = process.env.STRIPE_PRICE_BASE?.trim();
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    client_reference_id: agency.id,
    success_url: `${site}/dashboard/settings?tab=billing&checkout=ok`,
    cancel_url: `${site}/dashboard/settings?tab=billing`,
    line_items: priceId
      ? [{ price: priceId, quantity: 1 }]
      : [
          {
            price_data: {
              currency: 'eur',
              product_data: { name: `Priimo — ${agency.name}` },
              unit_amount: eurosVersCents(prixBaseDe(agency) || config.prixBase),
              recurring: { interval: 'month' },
            },
            quantity: 1,
          },
        ],
    metadata: { agency_id: agency.id },
    subscription_data: { metadata: { agency_id: agency.id } },
  });

  if (!session.url) {
    return NextResponse.json({ error: 'Session de paiement introuvable.' }, { status: 500 });
  }
  return NextResponse.json({ url: session.url });
}
