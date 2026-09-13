import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('agencies')
    .select(
      'id, name, address, email, phone, codes_postaux, statut_abonnement, demande_decision, demande_decidee_le, demande_notes, created_at',
    )
    .or(
      'demande_decision.eq.en_attente,demande_decision.eq.refusee,demande_decidee_le.not.is.null',
    )
    .order('created_at', { ascending: false })
    .limit(80);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const ids = (data ?? []).map((a) => a.id);
  const { data: links } = await admin
    .from('profile_agencies')
    .select('agency_id, profile_id, role')
    .in('agency_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000'])
    .eq('role', 'directeur');

  const profileIds = [...new Set((links ?? []).map((l) => l.profile_id))];
  const { data: profiles } = profileIds.length
    ? await admin.from('profiles').select('id, first_name, last_name, phone').in('id', profileIds)
    : { data: [] };

  const prenoms = new Map((profiles ?? []).map((p) => [p.id, p]));
  const dirParAgence = new Map((links ?? []).map((l) => [l.agency_id, l.profile_id]));

  const demandes = (data ?? []).map((a) => {
    const prof = prenoms.get(dirParAgence.get(a.id) ?? '');
    return {
      id: a.id,
      name: a.name,
      address: a.address,
      email: a.email,
      phone: a.phone ?? prof?.phone ?? null,
      codesPostaux: a.codes_postaux ?? [],
      decision: a.demande_decision,
      statut: a.statut_abonnement,
      createdAt: a.created_at,
      decideeLe: a.demande_decidee_le,
      notes: a.demande_notes,
      directeur: prof
        ? { prenom: prof.first_name, nom: prof.last_name }
        : null,
    };
  });

  return NextResponse.json({ demandes });
}
