import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

/** Enregistre une demande de couverture sectorielle (info commerciale). */
export async function POST(req: Request) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }

  const postalCode = typeof body.postalCode === 'string' ? body.postalCode.trim() : '';
  if (!/^\d{5}$/.test(postalCode)) {
    return NextResponse.json({ error: 'Code postal invalide' }, { status: 400 });
  }

  const ligne = {
    agency_id: agency.id,
    created_by: profile.id,
    postal_code: postalCode,
    city: typeof body.city === 'string' ? body.city.trim() || null : null,
    address: typeof body.address === 'string' ? body.address.trim() || null : null,
  };

  const session = await createSupabaseServerClient();
  const { error } = await session.from('estimation_coverage_demands').insert(ligne);
  if (!error) return NextResponse.json({ ok: true });

  // La demande est une information commerciale : elle oriente les prochains
  // imports, on ne la perd pas sur un refus de RLS. Seconde tentative en
  // service_role, qui reste bornée à l'agence de l'appelant.
  console.error('[estimation/coverage-demand] session', error.message);
  const { error: adminError } = await createSupabaseAdminClient()
    .from('estimation_coverage_demands')
    .insert(ligne);

  if (adminError) {
    // Rien n'a été écrit : on le dit, plutôt que de remercier dans le vide.
    console.error('[estimation/coverage-demand] admin', adminError.message);
    return NextResponse.json(
      { error: 'La demande n’a pas pu être enregistrée. Réessayez.' },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
