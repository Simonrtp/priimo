import { NextResponse } from 'next/server';
import { requireDirector } from '@/lib/auth/requireDirector';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { ProfileRole } from '@/types/database';

const ROLES: readonly ProfileRole[] = ['directeur', 'collaborateur'];

/**
 * Change le rôle d'un membre dans l'agence active.
 * Plusieurs directeurs coexistent : en nommer un laisse le rôle
 * à celui qui le nomme.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ profileId: string }> },
) {
  const guard = await requireDirector();
  if (!guard.ok) return guard.response;
  const { profileId } = await params;

  let body: { role?: unknown };
  try {
    body = (await request.json()) as { role?: unknown };
  } catch {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }

  const role = typeof body.role === 'string' ? body.role : '';
  if (!(ROLES as readonly string[]).includes(role)) {
    return NextResponse.json({ error: 'Rôle inconnu' }, { status: 400 });
  }
  const nextRole = role as ProfileRole;

  if (profileId === guard.user.id) {
    return NextResponse.json(
      { error: 'Vous ne pouvez pas modifier votre propre rôle.' },
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
    console.error('[team/role] load', loadErr);
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
  }
  if (!membership) {
    return NextResponse.json({ error: 'Membre introuvable dans cette agence.' }, { status: 404 });
  }
  if (membership.role === nextRole) {
    return NextResponse.json({ success: true });
  }
  if (membership.role === 'directeur') {
    return NextResponse.json(
      { error: 'Impossible de modifier le rôle d’un directeur.' },
      { status: 400 },
    );
  }

  if (nextRole === 'directeur') {
    const { error: promoteErr } = await admin
      .from('profile_agencies')
      .update({ role: 'directeur' })
      .eq('profile_id', profileId)
      .eq('agency_id', guard.agency.id);
    if (promoteErr) {
      console.error('[team/role] promote', promoteErr);
      return NextResponse.json({ error: 'Le rôle n’a pas pu être modifié.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Rôle inchangé' }, { status: 400 });
}

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
      { error: 'Impossible de retirer un directeur.' },
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
    // Supprimer le profil d'abord (données métier), puis Auth.
    // Si on ne fait que deleteUser et que ça échoue, le collab ne peut
    // plus être réinvité (email encore pris dans auth.users).
    const { error: delProfileErr } = await admin.from('profiles').delete().eq('id', profileId);
    if (delProfileErr) {
      console.error('[team/delete] profile', delProfileErr);
    }
    const { error: delUserErr } = await admin.auth.admin.deleteUser(profileId);
    if (delUserErr) {
      console.error('[team/delete] auth user', delUserErr);
      return NextResponse.json(
        {
          error:
            "Retiré de l'agence, mais le compte Auth n'a pas pu être effacé. Réessayez ou supprimez-le dans Supabase Auth.",
        },
        { status: 500 },
      );
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

  try {
    const { ajusterSiegesStripe, compterSiegesActifs } = await import('@/lib/billing/sieges');
    const restants = await compterSiegesActifs(admin, guard.agency.id);
    await ajusterSiegesStripe({ agency: guard.agency, siegesActifs: restants });
  } catch (err) {
    console.error('[team/delete] sieges', err);
  }

  return NextResponse.json({ success: true });
}
