import { NextResponse } from 'next/server';
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

    const normalizedPhone = normalizeFrenchPhone(phone);

    const { data: invitation, error: inviteError } = await supabaseAdmin
      .from('invitations')
      .select('*')
      .eq('token', token)
      .eq('role', 'directeur')
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (inviteError || !invitation) {
      return NextResponse.json({ error: 'Invitation invalide ou expirée' }, { status: 400 });
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: 'Erreur création utilisateur : ' + (authError?.message ?? 'inconnue') },
        { status: 500 },
      );
    }

    const { data: agency, error: agencyError } = await supabaseAdmin
      .from('agencies')
      .insert({
        name: agencyName.trim(),
        phone: normalizedPhone,
        plan: 'fondateur',
      })
      .select()
      .single();

    if (agencyError || !agency) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json(
        { error: 'Erreur création agence : ' + (agencyError?.message ?? 'inconnue') },
        { status: 500 },
      );
    }

    const { error: profileError } = await supabaseAdmin.from('profiles').insert({
      id: authData.user.id,
      agency_id: agency.id,
      role: 'directeur',
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

    await supabaseAdmin
      .from('invitations')
      .update({ used_at: new Date().toISOString() })
      .eq('token', token);

    return NextResponse.json({ success: true, userId: authData.user.id });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
