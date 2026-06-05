import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { markLeadsAsSeen } from '@/lib/queries/profiles';

export async function POST() {
  const { user, profile } = await getServerUser();
  if (!user || !profile) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const supabase = await createSupabaseServerClient();
  try {
    const leadsLastSeenAt = await markLeadsAsSeen(supabase, profile.id);
    return NextResponse.json({ leadsLastSeenAt });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erreur serveur';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
