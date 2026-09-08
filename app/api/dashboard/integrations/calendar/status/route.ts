import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

export async function GET() {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from('calendar_connexions')
    .select('calendar_email, etat, connected_at, dernier_erreur')
    .eq('agency_id', agency.id)
    .eq('profile_id', profile.id)
    .maybeSingle();

  if (!data || data.etat === 'revoke') {
    return NextResponse.json({ connected: false, emailPro: user.email });
  }

  return NextResponse.json({
    connected: data.etat === 'actif',
    calendarEmail: data.calendar_email,
    emailPro: user.email,
    etat: data.etat,
    connectedAt: data.connected_at,
    dernierErreur: data.dernier_erreur,
  });
}
