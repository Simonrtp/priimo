import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { viewerFromProfile } from '@/lib/agency/visibility';
import { normalizeIdu } from '@/lib/carte/parcelle';
import { fetchParcelleFiche } from '@/lib/queries/parcelle';

export const runtime = 'nodejs';

export async function GET(_req: Request, ctx: { params: Promise<{ idu: string }> }) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { idu: raw } = await ctx.params;
  const idu = normalizeIdu(decodeURIComponent(raw));
  if (!idu) {
    return NextResponse.json({ error: 'Parcelle inconnue' }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const fiche = await fetchParcelleFiche(admin, {
    idu,
    agencyId: agency.id,
    viewer: viewerFromProfile(profile),
  });

  return NextResponse.json(fiche);
}
