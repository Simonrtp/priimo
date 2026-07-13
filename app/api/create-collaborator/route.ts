import { NextResponse } from 'next/server';
import {
  getValidInvitationByToken,
  normalizeInviteEmail,
} from '@/lib/invitations/validate';
import { normalizeFrenchPhone, validateInviteFields } from '@/lib/invite-account';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  const supabaseAdmin = createSupabaseAdminClient();
  try {
    const { token, firstName, lastName, email, password, phone, acceptedCgu } =
      await request.json();

    const validationError = validateInviteFields({
      firstName,
      lastName,
      email,
      password,
      phone,
      acceptedCgu,
    });
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const normalizedEmail = normalizeInviteEmail(email);
    const normalizedPhone = normalizeFrenchPhone(phone);

    const { invitation, error: inviteLookupError } = await getValidInvitationByToken(token);
    if (!invitation || invitation.role !== 'collaborateur' || !invitation.agency_id) {
      return NextResponse.json(
        { error: inviteLookupError ?? 'Invitation invalide ou expirée' },
        { status: 400 },
      );
    }

    if (normalizedEmail !== invitation.email) {
      return NextResponse.json(
        { error: "L'email ne correspond pas à celui de l'invitation." },
        { status: 400 },
      );
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
    });

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: 'Erreur création utilisateur : ' + (authError?.message ?? 'inconnue') },
        { status: 500 },
      );
    }

    const { error: profileError } = await supabaseAdmin.from('profiles').insert({
      id: authData.user.id,
      agency_id: invitation.agency_id,
      role: 'collaborateur',
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      phone: normalizedPhone,
    });

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json(
        { error: 'Erreur création profil : ' + profileError.message },
        { status: 500 },
      );
    }

    const { error: membershipError } = await supabaseAdmin.from('profile_agencies').insert({
      profile_id: authData.user.id,
      agency_id: invitation.agency_id,
      role: 'collaborateur',
    });

    if (membershipError) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json(
        { error: 'Erreur rattachement agence : ' + membershipError.message },
        { status: 500 },
      );
    }

    await supabaseAdmin
      .from('invitations')
      .update({ used_at: new Date().toISOString() })
      .eq('token', token.trim());

    return NextResponse.json({ success: true, userId: authData.user.id, role: 'collaborateur' as const });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
