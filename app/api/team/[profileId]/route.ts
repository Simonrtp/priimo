import { NextResponse } from 'next/server';
import { requireDirector } from '@/lib/auth/requireDirector';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export async function DELETE(_request: Request, { params }: { params: Promise<{ profileId: string }> }) {
  const guard = await requireDirector();
  if (!guard.ok) return guard.response;
  const { profileId } = await params;

  if (profileId === guard.user.id) {
    return NextResponse.json({ error: 'Vous ne pouvez pas vous retirer vous-même.' }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data: membership, error: loadErr } = await admin
    .from('profile_agencies')
    .select('role')
    .eq('profile_id', profileId)
    .eq('agency_id', guard.agency.id)
    .maybeSingle();
  if (loadErr) {
    return NextResponse.json({ error: loadErr.message }, { status: 500 });
  }
  if (!membership) {
    return NextResponse.json({ error: 'Membre introuvable.' }, { status: 404 });
  }
  if (membership.role === 'directeur') {
    return NextResponse.json({ error: 'Impossible de retirer le directeur.' }, { status: 400 });
  }

  const { error: delErr } = await admin.auth.admin.deleteUser(profileId);
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
