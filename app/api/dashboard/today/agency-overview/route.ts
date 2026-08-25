import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { AgencyScopeError } from '@/lib/queries/agency-members';
import {
  AgencyOverviewForbiddenError,
  fetchAgencyOverview,
} from '@/lib/queries/agency-overview';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET() {
  const { user, profile, agency, memberships } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  try {
    const supabase = await createSupabaseServerClient();
    const overview = await fetchAgencyOverview({
      supabase,
      agencyId: agency.id,
      memberships,
      role: profile.role,
      agencyPostalCodes: agency.codes_postaux ?? [],
    });
    return NextResponse.json({ overview });
  } catch (err) {
    if (err instanceof AgencyOverviewForbiddenError || err instanceof AgencyScopeError) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }
    console.error('[today/agency-overview]', err);
    return NextResponse.json({ error: 'Impossible de charger la vue agence' }, { status: 500 });
  }
}
