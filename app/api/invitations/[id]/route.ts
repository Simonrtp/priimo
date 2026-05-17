import { NextResponse } from 'next/server';
import { requireDirector } from '@/lib/auth/requireDirector';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireDirector();
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const admin = createSupabaseAdminClient();
  const { data: invitation, error: loadErr } = await admin
    .from('invitations')
    .select('id, agency_id, created_by')
    .eq('id', id)
    .maybeSingle();
  if (loadErr) {
    return NextResponse.json({ error: loadErr.message }, { status: 500 });
  }
  if (!invitation) {
    return NextResponse.json({ error: 'Invitation introuvable.' }, { status: 404 });
  }
  if (invitation.agency_id !== guard.agency.id) {
    return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 });
  }

  const { error: delErr } = await admin.from('invitations').delete().eq('id', id);
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
