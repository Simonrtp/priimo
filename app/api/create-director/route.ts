import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

// Client avec service_role pour bypasser RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // Clé admin
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export async function POST(request: Request) {
  try {
    const { token, agencyName, firstName, lastName, email, password } = await request.json();

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
        name: agencyName,
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
        first_name: firstName,
        last_name: lastName,
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