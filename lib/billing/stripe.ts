import Stripe from 'stripe';

export function stripeSecretKey(): string | null {
  return process.env.STRIPE_SECRET_KEY?.trim() || null;
}

export function stripeWebhookSecret(): string | null {
  return process.env.STRIPE_WEBHOOK_SECRET?.trim() || null;
}

let client: Stripe | null = null;

export function stripeClient(): Stripe {
  const key = stripeSecretKey();
  if (!key) throw new Error('STRIPE_SECRET_KEY manquante.');
  if (!client) {
    client = new Stripe(key);
  }
  return client;
}

export function stripeDisponible(): boolean {
  return Boolean(stripeSecretKey());
}
