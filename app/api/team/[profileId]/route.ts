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
  const { data: target, error: loadErr } = await admin
    .from('profiles')
    .select('id, agency_id, role')
    .eq('id', profileId)
    .maybeSingle();
  if (loadErr) {
    return NextResponse.json({ error: loadErr.message }, { status: 500 });
  }
  if (!target) {
    return NextResponse.json({ error: 'Membre introuvable.' }, { status: 404 });
  }
  if (target.agency_id !== guard.agency.id) {
    return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 });
  }
  if (target.role === 'directeur') {
    return NextResponse.json({ error: 'Impossible de retirer le directeur.' }, { status: 400 });
  }

  const { error: delErr } = await admin.auth.admin.deleteUser(profileId);
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
