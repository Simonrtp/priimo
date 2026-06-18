import { NextResponse } from 'next/server';
import { requireInvitationAdmin } from '@/lib/invitations/admin-auth';
import { createAndSendDirectorInvite } from '@/lib/invitations/director-invite';

/**
 * Crée une invitation directeur (si besoin) et envoie l'email Resend.
 * Auth : Authorization: Bearer <INVITATION_ADMIN_SECRET>
 *
 * Body JSON : { email, agencyName, token? }
 * - token optionnel : token personnalisé (sinon généré automatiquement)
 */
export async function POST(request: Request) {
  const authError = requireInvitationAdmin(request);
  if (authError) return authError;

  let body: { email?: unknown; agencyName?: unknown; token?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }

  const result = await createAndSendDirectorInvite({
    email: typeof body.email === 'string' ? body.email : '',
    agencyName: typeof body.agencyName === 'string' ? body.agencyName : '',
    token: typeof body.token === 'string' ? body.token : undefined,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ success: true, ...result.result });
}
