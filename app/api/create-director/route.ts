import { NextResponse } from 'next/server';
import { provisionInviteAccount } from '@/lib/invitations/provision-account';
import { clientIpFromRequest, pruneRateLimitBuckets, rateLimit } from '@/lib/rate-limit';

export async function POST(request: Request) {
  pruneRateLimitBuckets();
  const ip = clientIpFromRequest(request);
  const rl = rateLimit(`create-director:${ip}`, { limit: 10, windowMs: 60 * 60 * 1000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Trop de requêtes. Réessayez plus tard.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
    );
  }

  try {
    const body = await request.json();
    const result = await provisionInviteAccount({
      token: typeof body.token === 'string' ? body.token : '',
      agencyName: typeof body.agencyName === 'string' ? body.agencyName : '',
      firstName: typeof body.firstName === 'string' ? body.firstName : '',
      lastName: typeof body.lastName === 'string' ? body.lastName : '',
      email: typeof body.email === 'string' ? body.email : '',
      password: typeof body.password === 'string' ? body.password : '',
      phone: typeof body.phone === 'string' ? body.phone : '',
      acceptedCgu: Boolean(body.acceptedCgu),
      expectedRole: 'directeur',
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({
      success: true,
      userId: result.userId,
      role: result.role,
    });
  } catch (error: unknown) {
    console.error('[create-director]', error);
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
  }
}
