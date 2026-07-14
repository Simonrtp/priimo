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
    const { token, agencyName, firstName, lastName, email, password, phone, acceptedCgu } =
      await request.json();

    const validationError = validateInviteFields(
      { agencyName, firstName, lastName, email, password, phone, acceptedCgu },
      { requireAgencyName: true },
    );
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const normalizedEmail = normalizeInviteEmail(email);
    const normalizedPhone = normalizeFrenchPhone(phone);

    const { invitation, error: inviteLookupError } = await getValidInvitationByToken(token);
    if (!invitation || invitation.role !== 'directeur') {
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

    const resolvedAgencyName = (agencyName ?? '').trim() || invitation.agency_name || '';
    if (!resolvedAgencyName) {
      return NextResponse.json({ error: "Le nom de l'agence est obligatoire." }, { status: 400 });
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

    let agency: { id: string };

    if (invitation.agency_id) {
      const { data: existingAgency, error: loadAgencyErr } = await supabaseAdmin
        .from('agencies')
        .select('id')
        .eq('id', invitation.agency_id)
        .maybeSingle();
      if (loadAgencyErr || !existingAgency) {
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        return NextResponse.json({ error: 'Agence liée à l\'invitation introuvable.' }, { status: 400 });
      }
      agency = existingAgency;
    } else {
      const { data: newAgency, error: agencyError } = await supabaseAdmin
        .from('agencies')
        .insert({
          name: resolvedAgencyName,
          phone: normalizedPhone,
          email: normalizedEmail,
          plan: 'fondateur',
        })
        .select('id')
        .single();

      if (agencyError || !newAgency) {
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        return NextResponse.json(
          { error: 'Erreur création agence : ' + (agencyError?.message ?? 'inconnue') },
          { status: 500 },
        );
      }
      agency = newAgency;
    }

    const { error: profileError } = await supabaseAdmin.from('profiles').insert({
      id: authData.user.id,
      active_agency_id: agency.id,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      phone: normalizedPhone,
    });

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      await supabaseAdmin.from('agencies').delete().eq('id', agency.id);
      return NextResponse.json(
        { error: 'Erreur création profil : ' + profileError.message },
        { status: 500 },
      );
    }

    const { error: membershipError } = await supabaseAdmin.from('profile_agencies').insert({
      profile_id: authData.user.id,
      agency_id: agency.id,
      role: 'directeur',
    });

    if (membershipError) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      await supabaseAdmin.from('agencies').delete().eq('id', agency.id);
      return NextResponse.json(
        { error: 'Erreur rattachement agence : ' + membershipError.message },
        { status: 500 },
      );
    }

    await supabaseAdmin
      .from('invitations')
      .update({ used_at: new Date().toISOString() })
      .eq('token', token.trim());

    return NextResponse.json({ success: true, userId: authData.user.id, role: 'directeur' as const });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
