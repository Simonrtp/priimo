import { NextResponse } from 'next/server';
import { requireDirector } from '@/lib/auth/requireDirector';
import { stripeClient, stripeDisponible } from '@/lib/billing/stripe';

export const runtime = 'nodejs';

export async function POST() {
  const guard = await requireDirector();
  if (!guard.ok) return guard.response;
  if (!stripeDisponible()) {
    return NextResponse.json({ error: 'Paiement non configuré.' }, { status: 503 });
  }
  if (!guard.agency.stripe_customer_id) {
    return NextResponse.json({ error: 'Aucun abonnement à gérer pour l’instant.' }, { status: 400 });
  }

  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  const session = await stripeClient().billingPortal.sessions.create({
    customer: guard.agency.stripe_customer_id,
    return_url: `${site}/dashboard/settings?tab=billing`,
  });
  return NextResponse.json({ url: session.url });
}
