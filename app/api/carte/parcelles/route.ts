import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { viewerFromProfile } from '@/lib/agency/visibility';
import { fetchParcelleOverlays } from '@/lib/queries/parcelle';

export const runtime = 'nodejs';

export async function GET() {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const overlays = await fetchParcelleOverlays(admin, {
    agencyId: agency.id,
    postalCodes: agency.codes_postaux ?? [],
    viewer: viewerFromProfile(profile),
  });

  return NextResponse.json(overlays);
}
