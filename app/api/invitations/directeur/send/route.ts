import { NextResponse } from 'next/server';
import { requireInvitationAdmin } from '@/lib/invitations/admin-auth';
import { sendDirectorInviteByToken } from '@/lib/invitations/director-invite';

/**
 * Envoie l'email pour une invitation directeur déjà en base (ex. après INSERT SQL).
 * Auth : Authorization: Bearer <INVITATION_ADMIN_SECRET>
 *
 * Body JSON : { token }
 */
export async function POST(request: Request) {
  const authError = requireInvitationAdmin(request);
  if (authError) return authError;

  let body: { token?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }

  const token = typeof body.token === 'string' ? body.token : '';
  const result = await sendDirectorInviteByToken(token);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ success: true, ...result.result });
}
