import { NextResponse } from 'next/server';
import { getValidInvitationByToken } from '@/lib/invitations/validate';

/** Valide un token d'invitation (service_role — contourne RLS anon). */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token');
  if (!token?.trim()) {
    return NextResponse.json({ error: "Token d'invitation manquant" }, { status: 400 });
  }

  const { invitation, error } = await getValidInvitationByToken(token);
  if (!invitation) {
    return NextResponse.json({ error: error ?? 'Invitation invalide ou expirée' }, { status: 404 });
  }

  return NextResponse.json({ invitation });
}
