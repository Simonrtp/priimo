import { NextResponse } from 'next/server';
import { clientIpFromRequest, pruneRateLimitBuckets, rateLimit } from '@/lib/rate-limit';

/**
 * Pré-check login : rate-limit IP uniquement.
 * Le captcha (Turnstile) est réservé à l'inscription — le formulaire de
 * connexion n'en envoie pas, le exiger ici bloquait tous les logins.
 */
export async function POST(request: Request) {
  pruneRateLimitBuckets();
  const ip = clientIpFromRequest(request);
  const rl = rateLimit(`login:${ip}`, { limit: 20, windowMs: 15 * 60 * 1000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Trop de tentatives. Réessayez dans quelques minutes.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
    );
  }

  return NextResponse.json({ ok: true });
}
