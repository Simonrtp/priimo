import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { viewerFromProfile } from '@/lib/agency/visibility';
import { fetchParcelleOverlays } from '@/lib/queries/parcelle';
import { parseDpeAgeParam } from '@/lib/carte/dpe-age';
import { estEnAttente } from '@/lib/billing/acces';

export const runtime = 'nodejs';

function num(v: string | null, fallback: number): number {
  if (v == null || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export async function GET(req: Request) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }
  if (estEnAttente(agency)) {
    return NextResponse.json({
      immeubles: [],
      notes: [],
      sources: { diagnosticsAt: null, ventesAt: null },
    });
  }

  const url = new URL(req.url);
  const zoom = num(url.searchParams.get('zoom'), 0);
  const west = url.searchParams.get('west');
  const south = url.searchParams.get('south');
  const east = url.searchParams.get('east');
  const north = url.searchParams.get('north');
  const viewport =
    west != null && south != null && east != null && north != null
      ? {
          west: num(west, 0),
          south: num(south, 0),
          east: num(east, 0),
          north: num(north, 0),
          zoom,
        }
      : null;

  const overlays = await fetchParcelleOverlays({
    publicDb: createSupabaseAdminClient(),
    agencyDb: await createSupabaseServerClient(),
    agencyId: agency.id,
    postalCodes: agency.codes_postaux ?? [],
    viewer: viewerFromProfile(profile),
    viewport,
    dpeAges: parseDpeAgeParam(url.searchParams.get('ages')),
    includeDpeDetail: url.searchParams.get('dpe') === '1',
  });

  return NextResponse.json(overlays);
}
