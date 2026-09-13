import { NextResponse } from 'next/server';
import { clientIpFromRequest, pruneRateLimitBuckets, rateLimit } from '@/lib/rate-limit';
import { verifyTurnstileToken } from '@/lib/turnstile';
import { creerInscription } from '@/lib/inscription/creer';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  pruneRateLimitBuckets();
  const ip = clientIpFromRequest(req);
  const lim = rateLimit(`inscription:${ip}`, { limit: 8, windowMs: 60 * 60 * 1000 });
  if (!lim.ok) {
    return NextResponse.json(
      { error: 'Trop de tentatives. Réessayez plus tard.' },
      { status: 429, headers: { 'Retry-After': String(lim.retryAfterSec) } },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }

  const captcha = await verifyTurnstileToken(
    typeof body.turnstileToken === 'string' ? body.turnstileToken : null,
    ip,
  );
  if (!captcha.ok) {
    return NextResponse.json({ error: captcha.error }, { status: 400 });
  }

  const result = await creerInscription({
    email: typeof body.email === 'string' ? body.email : '',
    password: typeof body.password === 'string' ? body.password : '',
    firstName: typeof body.firstName === 'string' ? body.firstName : '',
    lastName: typeof body.lastName === 'string' ? body.lastName : '',
    phone: typeof body.phone === 'string' ? body.phone : '',
    agencyName: typeof body.agencyName === 'string' ? body.agencyName : '',
    address: typeof body.address === 'string' ? body.address : '',
    latitude: Number(body.latitude),
    longitude: Number(body.longitude),
    codesPostaux: body.codesPostaux,
    acceptedCgu: body.acceptedCgu === true,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true });
}
