import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export async function POST(request: Request) {
  try {
    const { token, firstName, lastName, email, password } = await request.json();

    // 1. Vérifier le token
    const { data: invitation, error: inviteError } = await supabaseAdmin
      .from('invitations')
      .select('*')
      .eq('token', token)
      .eq('role', 'collaborateur')
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (inviteError || !invitation || !invitation.agency_id) {
      return NextResponse.json(
        { error: 'Invitation invalide ou expirée' },
        { status: 400 }
      );
    }

    // 2. Créer l'utilisateur
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: 'Erreur création utilisateur: ' + authError?.message },
        { status: 500 }
      );
    }

    // 3. Créer le profil collaborateur
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: authData.user.id,
        agency_id: invitation.agency_id,
        role: 'collaborateur',
        first_name: firstName,
        last_name: lastName,
      });

    if (profileError) {
      // Rollback
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json(
        { error: 'Erreur création profil: ' + profileError.message },
        { status: 500 }
      );
    }

    // 4. Marquer l'invitation comme utilisée
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