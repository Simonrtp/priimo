import { randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import { requireDirector } from '@/lib/auth/requireDirector';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { sendInvitationEmail } from '@/lib/email/sendInvitationEmail';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireDirector();
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const admin = createSupabaseAdminClient();
  const { data: invitation, error: loadErr } = await admin
    .from('invitations')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (loadErr) {
    return NextResponse.json({ error: loadErr.message }, { status: 500 });
  }
  if (!invitation) {
    return NextResponse.json({ error: 'Invitation introuvable.' }, { status: 404 });
  }
  if (invitation.agency_id !== guard.agency.id) {
    return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 });
  }
  if (invitation.used_at) {
    return NextResponse.json({ error: 'Invitation déjà acceptée.' }, { status: 409 });
  }

  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
  const { error: updateErr } = await admin
    .from('invitations')
    .update({ token, expires_at: expiresAt })
    .eq('id', id);
  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  try {
    await sendInvitationEmail({
      to: invitation.email,
      token,
      agencyName: guard.agency.name,
      directorFirstName: guard.profile.first_name,
      directorLastName: guard.profile.last_name,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "L'email n'a pas pu être envoyé.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
