import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

/** État de la connexion Gmail de l'utilisateur courant (pas de jetons). */
export async function GET() {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from('gmail_connexions')
    .select('gmail_address, etat, watch_expiration, connected_at, dernier_erreur')
    .eq('agency_id', agency.id)
    .eq('profile_id', profile.id)
    .maybeSingle();

  if (!data || data.etat === 'revoke') {
    return NextResponse.json({ connected: false });
  }

  return NextResponse.json({
    connected: true,
    gmailAddress: data.gmail_address,
    etat: data.etat,
    watchExpiration: data.watch_expiration,
    connectedAt: data.connected_at,
    dernierErreur: data.dernier_erreur,
  });
}
