import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { viewerFromProfile } from '@/lib/agency/visibility';
import { normalizeParcelleId } from '@/lib/carte/parcelle-id';
import { fetchParcelleFiche } from '@/lib/queries/parcelle';

export const runtime = 'nodejs';

export async function GET(_req: Request, ctx: { params: Promise<{ parcelleId: string }> }) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { parcelleId: raw } = await ctx.params;
  const parcelleId = normalizeParcelleId(decodeURIComponent(raw));
  if (!parcelleId) {
    return NextResponse.json({ error: 'Parcelle inconnue' }, { status: 400 });
  }

  const [publicDb, agencyDb] = [createSupabaseAdminClient(), await createSupabaseServerClient()];
  const fiche = await fetchParcelleFiche({
    publicDb,
    agencyDb,
    parcelleId,
    agencyId: agency.id,
    postalCodes: agency.codes_postaux ?? [],
    viewer: viewerFromProfile(profile),
  });

  return NextResponse.json(fiche);
}
