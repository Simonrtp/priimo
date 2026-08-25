import { NextResponse } from 'next/server';
import { canAccessAgency } from '@/lib/auth/active-agency';
import { canSeeLeadRecord, viewerFromProfile } from '@/lib/agency/visibility';
import { fetchStreetViewImage, parseFacadeFormat } from '@/lib/facade/street-view';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(req: Request, ctx: { params: Promise<{ leadId: string }> }) {
  const { user, profile, memberships } = await getServerUser();
  if (!user || !profile) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { leadId } = await ctx.params;
  if (!leadId) return new NextResponse(null, { status: 404 });

  const supabase = await createSupabaseServerClient();
  const { data: lead, error } = await supabase
    .from('leads')
    .select('id, agency_id, latitude, longitude, assigned_to')
    .eq('id', leadId)
    .maybeSingle();

  if (error || !lead) return new NextResponse(null, { status: 404 });

  const belongsToAgency = canAccessAgency(memberships, lead.agency_id);
  if (!belongsToAgency) return new NextResponse(null, { status: 404 });

  const viewer = viewerFromProfile(profile);
  if (!canSeeLeadRecord(viewer, { assignedTo: lead.assigned_to })) {
    return new NextResponse(null, { status: 404 });
  }

  const latitude = lead.latitude;
  const longitude = lead.longitude;
  if (latitude == null || longitude == null) return new NextResponse(null, { status: 404 });

  const format = parseFacadeFormat(new URL(req.url).searchParams.get('format'));
  return fetchStreetViewImage(latitude, longitude, format);
}
