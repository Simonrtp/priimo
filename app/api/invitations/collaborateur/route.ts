import { randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import { requireDirector } from '@/lib/auth/requireDirector';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { sendInvitationEmail } from '@/lib/email/sendInvitationEmail';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const guard = await requireDirector();
  if (!guard.ok) return guard.response;

  let payload: { email?: unknown };
  try {
    payload = (await request.json()) as { email?: unknown };
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }
  const rawEmail = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
  if (!rawEmail || !EMAIL_REGEX.test(rawEmail)) {
    return NextResponse.json({ error: 'Adresse email invalide.' }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();

  const { data: existingByEmail, error: listErr } = await admin.auth.admin.listUsers();
  if (listErr) {
    return NextResponse.json({ error: 'Erreur de vérification utilisateur.' }, { status: 500 });
  }
  const existingUser = existingByEmail.users.find(
    (u) => (u.email ?? '').toLowerCase() === rawEmail,
  );
  if (existingUser) {
    const { data: existingMembership } = await admin
      .from('profile_agencies')
      .select('agency_id')
      .eq('profile_id', existingUser.id)
      .eq('agency_id', guard.agency.id)
      .maybeSingle();
    if (existingMembership) {
      return NextResponse.json(
        { error: 'Cet utilisateur fait déjà partie de votre agence.' },
        { status: 409 },
      );
    }
  }

  const nowIso = new Date().toISOString();
  const { data: existingInvite } = await admin
    .from('invitations')
    .select('id')
    .eq('email', rawEmail)
    .eq('agency_id', guard.agency.id)
    .is('used_at', null)
    .gt('expires_at', nowIso)
    .maybeSingle();
  if (existingInvite) {
    return NextResponse.json(
      { error: 'Une invitation est déjà en cours pour cette adresse.' },
      { status: 409 },
    );
  }

  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

  const { error: insertErr } = await admin.from('invitations').insert({
    token,
    email: rawEmail,
    role: 'collaborateur',
    agency_id: guard.agency.id,
    created_by: guard.user.id,
    expires_at: expiresAt,
  });
  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  try {
    await sendInvitationEmail({
      to: rawEmail,
      token,
      agencyName: guard.agency.name,
      directorFirstName: guard.profile.first_name,
      directorLastName: guard.profile.last_name,
    });
  } catch (e) {
    await admin.from('invitations').delete().eq('token', token);
    const message = e instanceof Error ? e.message : "L'email n'a pas pu être envoyé.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
