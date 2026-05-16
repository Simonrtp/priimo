import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { normalizeFrenchPhone, validateInviteFields } from '@/lib/invite-account';
import { getSupabaseServiceRoleKey, getSupabaseUrl } from '@/lib/supabase/env';

function getSupabaseAdmin(): SupabaseClient {
  return createClient(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function POST(request: Request) {
  const supabaseAdmin = getSupabaseAdmin();
  try {
    const { token, agencyName, firstName, lastName, email, password, phone, acceptedCgu } =
      await request.json();

    const validationError = validateInviteFields(
      { agencyName, firstName, lastName, email, password, phone, acceptedCgu },
      { requireAgencyName: true }
    );
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const normalizedPhone = normalizeFrenchPhone(phone);

    // 1. Vérifier le token
    const { data: invitation, error: inviteError } = await supabaseAdmin
      .from('invitations')
      .select('*')
      .eq('token', token)
      .eq('role', 'directeur')
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (inviteError || !invitation) {
      return NextResponse.json(
        { error: 'Invitation invalide ou expirée' },
        { status: 400 }
      );
    }

    // 2. Créer l'utilisateur dans auth.users
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirmer l'email
    });

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: 'Erreur création utilisateur: ' + authError?.message },
        { status: 500 }
      );
    }

    // 3. Créer l'agence
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
      // Rollback: supprimer l'user créé
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json(
        { error: 'Erreur création agence: ' + agencyError?.message },
        { status: 500 }
      );
    }

    // 4. Créer le profil directeur
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: authData.user.id,
        agency_id: agency.id,
        role: 'directeur',
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: normalizedPhone,
      });

    if (profileError) {
      // Rollback
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      await supabaseAdmin.from('agencies').delete().eq('id', agency.id);
      return NextResponse.json(
        { error: 'Erreur création profil: ' + profileError.message },
        { status: 500 }
      );
    }

    // 5. Marquer l'invitation comme utilisée
    await supabaseAdmin
      .from('invitations')
      .update({ used_at: new Date().toISOString() })
      .eq('token', token);

    return NextResponse.json({ success: true, userId: authData.user.id });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erreur serveur' },
      { status: 500 }
    );
  }
}