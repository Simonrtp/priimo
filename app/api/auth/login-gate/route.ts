import { NextResponse } from 'next/server';
import { clientIpFromRequest, pruneRateLimitBuckets, rateLimit } from '@/lib/rate-limit';
import { verifyTurnstileToken } from '@/lib/turnstile';

/**
 * Pré-check login : rate-limit IP (+ Turnstile si configuré).
 * Le sign-in reste côté client Supabase.
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

  let body: { turnstileToken?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    // empty body ok when Turnstile off
  }

  const captcha = await verifyTurnstileToken(
    typeof body.turnstileToken === 'string' ? body.turnstileToken : null,
    ip,
  );
  if (!captcha.ok) {
    return NextResponse.json({ error: captcha.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
