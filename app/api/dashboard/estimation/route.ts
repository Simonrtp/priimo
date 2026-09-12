import { NextResponse } from 'next/server';
import { invaliderEstimation } from '@/lib/cache/dashboard';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { viewerFromProfile } from '@/lib/agency/visibility';
import { visibleEstimationsFor } from '@/lib/agency/scope-records';
import { isEtat, isMotif } from '@/lib/estimation/cycle';
import { ESTIMATION_LIST_SELECT, ESTIMATION_SELECT, mapEstimation } from '@/lib/estimation/objet';

export const runtime = 'nodejs';

export async function GET() {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const session = await createSupabaseServerClient();
  const { data, error } = await session
    .from('agency_estimations')
    .select(ESTIMATION_LIST_SELECT)
    .eq('agency_id', agency.id)
    .order('updated_at', { ascending: false })
    .limit(80);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const viewer = viewerFromProfile(profile);
  const visible = visibleEstimationsFor(
    viewer,
    (data ?? []).map((r) => ({
      ...r,
      referentId: r.referent_id,
      createdBy: r.created_by,
    })),
  );

  return NextResponse.json({
    estimations: visible.map((r) => ({
      id: r.id,
      address: r.address,
      postalCode: r.postal_code,
      city: r.city,
      motif: isMotif(r.motif) ? r.motif : 'projet_vente',
      etat: isEtat(r.etat) ? r.etat : 'brouillon',
      referentId: r.referent_id,
      priceValue: r.price_value,
      priceLow: r.price_low,
      priceHigh: r.price_high,
      available: r.available,
      occupation: r.occupation,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })),
  });
}

export async function POST() {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const session = await createSupabaseServerClient();
  const { data, error } = await session
    .from('agency_estimations')
    .insert({
      agency_id: agency.id,
      created_by: profile.id,
      referent_id: profile.id,
      motif: 'projet_vente',
      etat: 'brouillon',
      occupation: 'libre',
      honoraires_pct: 5,
    })
    .select(ESTIMATION_SELECT)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Création impossible' }, { status: 500 });
  }

  invaliderEstimation();

  return NextResponse.json({ estimation: mapEstimation(data) });
}
