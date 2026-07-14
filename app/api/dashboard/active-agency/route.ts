import { NextResponse } from 'next/server';
import { canAccessAgency } from '@/lib/auth/active-agency';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const { user, profile, memberships } = await getServerUser();
  if (!user || !profile) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  let body: { agencyId?: string };
  try {
    body = (await request.json()) as { agencyId?: string };
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }

  const agencyId = typeof body.agencyId === 'string' ? body.agencyId.trim() : '';
  if (!agencyId) {
    return NextResponse.json({ error: 'agencyId requis' }, { status: 400 });
  }

  if (!canAccessAgency(memberships, agencyId)) {
    return NextResponse.json({ error: 'Agence non autorisée' }, { status: 403 });
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('profiles')
    .update({ active_agency_id: agencyId })
    .eq('id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, agencyId });
}
