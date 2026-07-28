import { NextResponse } from 'next/server';
import { requireDirector } from '@/lib/auth/requireDirector';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * Retire un collaborateur de l'agence active.
 * Ne supprime le compte Auth que s'il ne reste aucune membership ailleurs.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ profileId: string }> },
) {
  const guard = await requireDirector();
  if (!guard.ok) return guard.response;
  const { profileId } = await params;

  if (profileId === guard.user.id) {
    return NextResponse.json(
      { error: 'Vous ne pouvez pas vous retirer vous-même.' },
      { status: 400 },
    );
  }

  const admin = createSupabaseAdminClient();
  const { data: membership, error: loadErr } = await admin
    .from('profile_agencies')
    .select('role')
    .eq('profile_id', profileId)
    .eq('agency_id', guard.agency.id)
    .maybeSingle();
  if (loadErr) {
    console.error('[team/delete] load membership', loadErr);
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
  }
  if (!membership) {
    return NextResponse.json({ error: 'Membre introuvable.' }, { status: 404 });
  }
  if (membership.role === 'directeur') {
    return NextResponse.json(
      { error: 'Impossible de retirer le directeur.' },
      { status: 400 },
    );
  }

  const { error: delMembershipErr } = await admin
    .from('profile_agencies')
    .delete()
    .eq('profile_id', profileId)
    .eq('agency_id', guard.agency.id);
  if (delMembershipErr) {
    console.error('[team/delete] membership', delMembershipErr);
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
  }

  const { data: remaining, error: remainingErr } = await admin
    .from('profile_agencies')
    .select('agency_id')
    .eq('profile_id', profileId)
    .limit(1);
  if (remainingErr) {
    console.error('[team/delete] remaining check', remainingErr);
    return NextResponse.json({ success: true });
  }

  if (!remaining || remaining.length === 0) {
    const { data: profile } = await admin
      .from('profiles')
      .select('active_agency_id')
      .eq('id', profileId)
      .maybeSingle();
    if (profile?.active_agency_id === guard.agency.id) {
      await admin.from('profiles').update({ active_agency_id: null }).eq('id', profileId);
    }
    const { error: delUserErr } = await admin.auth.admin.deleteUser(profileId);
    if (delUserErr) {
      console.error('[team/delete] orphan auth user', delUserErr);
    }
  } else {
    const { data: profile } = await admin
      .from('profiles')
      .select('active_agency_id')
      .eq('id', profileId)
      .maybeSingle();
    if (profile?.active_agency_id === guard.agency.id) {
      await admin
        .from('profiles')
        .update({ active_agency_id: remaining[0].agency_id })
        .eq('id', profileId);
    }
  }

  return NextResponse.json({ success: true });
}
