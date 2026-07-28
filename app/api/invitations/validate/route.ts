import { NextResponse } from 'next/server';
import { getValidInvitationByToken } from '@/lib/invitations/validate';
import { clientIpFromRequest, pruneRateLimitBuckets, rateLimit } from '@/lib/rate-limit';

/** Valide un token d'invitation (service_role — contourne RLS anon). */
export async function GET(request: Request) {
  pruneRateLimitBuckets();
  const ip = clientIpFromRequest(request);
  const rl = rateLimit(`invite-validate:${ip}`, { limit: 40, windowMs: 15 * 60 * 1000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Trop de requêtes. Réessayez plus tard.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
    );
  }

  const token = new URL(request.url).searchParams.get('token');
  if (!token?.trim()) {
    return NextResponse.json({ error: "Token d'invitation manquant" }, { status: 400 });
  }

  const { invitation, error } = await getValidInvitationByToken(token);
  if (!invitation) {
    return NextResponse.json({ error: error ?? 'Invitation invalide ou expirée' }, { status: 404 });
  }

  return NextResponse.json({
    invitation: {
      email: invitation.email,
      role: invitation.role,
      agency_name: invitation.agency_name,
    },
  });
}
