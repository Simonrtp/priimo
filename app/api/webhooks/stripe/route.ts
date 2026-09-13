import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { stripeClient, stripeWebhookSecret } from '@/lib/billing/stripe';
import type { StatutAbonnement } from '@/types/database';

export const runtime = 'nodejs';

function agencyIdDepuis(obj: { metadata?: Stripe.Metadata | null }): string | null {
  const id = obj.metadata?.agency_id?.trim();
  return id || null;
}

function idClient(value: string | { id: string } | null | undefined): string | undefined {
  if (!value) return undefined;
  return typeof value === 'string' ? value : value.id;
}

function idAbonnementFacture(invoice: Stripe.Invoice): string | undefined {
  const legacy = (invoice as { subscription?: string | { id: string } | null }).subscription;
  if (typeof legacy === 'string') return legacy;
  if (legacy && typeof legacy === 'object') return legacy.id;
  const parent = invoice.parent as
    | { subscription_details?: { subscription?: string | { id: string } | null } }
    | null
    | undefined;
  const fromParent = parent?.subscription_details?.subscription;
  if (typeof fromParent === 'string') return fromParent;
  return fromParent?.id;
}

async function appliquerStatut(params: {
  agencyId?: string | null;
  customerId?: string | null;
  subscriptionId?: string | null;
  statut: StatutAbonnement;
}) {
  const admin = createSupabaseAdminClient();
  let query = admin.from('agencies').update({
    statut_abonnement: params.statut,
    ...(params.customerId ? { stripe_customer_id: params.customerId } : {}),
    ...(params.subscriptionId ? { stripe_subscription_id: params.subscriptionId } : {}),
  });

  if (params.agencyId) query = query.eq('id', params.agencyId);
  else if (params.subscriptionId) query = query.eq('stripe_subscription_id', params.subscriptionId);
  else if (params.customerId) query = query.eq('stripe_customer_id', params.customerId);
  else return;

  const { error } = await query;
  if (error) console.error('[stripe webhook] update', error.message);
}

export async function POST(req: Request) {
  const secret = stripeWebhookSecret();
  if (!secret) {
    return NextResponse.json({ error: 'Webhook non configuré.' }, { status: 503 });
  }

  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Signature absente.' }, { status: 400 });
  }

  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = stripeClient().webhooks.constructEvent(raw, signature, secret);
  } catch (err) {
    console.error('[stripe webhook] signature', err);
    return NextResponse.json({ error: 'Signature invalide.' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        if (session.mode !== 'subscription') break;
        const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
        const customerId = idClient(session.customer);
        await appliquerStatut({
          agencyId: agencyIdDepuis(session) ?? session.client_reference_id,
          customerId,
          subscriptionId: subId,
          statut: 'actif',
        });
        break;
      }
      case 'invoice.paid': {
        const invoice = event.data.object;
        await appliquerStatut({
          customerId: idClient(invoice.customer),
          subscriptionId: idAbonnementFacture(invoice),
          statut: 'actif',
        });
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        await appliquerStatut({
          customerId: idClient(invoice.customer),
          subscriptionId: idAbonnementFacture(invoice),
          statut: 'impaye',
        });
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const customerId = idClient(sub.customer);
        await appliquerStatut({
          agencyId: agencyIdDepuis(sub),
          customerId,
          subscriptionId: sub.id,
          statut: 'resilie',
        });
        break;
      }
      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const customerId = idClient(sub.customer);
        let statut: StatutAbonnement = 'actif';
        if (sub.status === 'past_due' || sub.status === 'unpaid') statut = 'impaye';
        else if (sub.status === 'canceled' || sub.status === 'incomplete_expired') statut = 'resilie';
        else if (sub.status === 'trialing') statut = 'essai';
        await appliquerStatut({
          agencyId: agencyIdDepuis(sub),
          customerId,
          subscriptionId: sub.id,
          statut,
        });
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error('[stripe webhook] handler', err);
    return NextResponse.json({ error: 'Traitement impossible.' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
