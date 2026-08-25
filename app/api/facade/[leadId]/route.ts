import { NextResponse } from 'next/server';
import { canAccessAgency } from '@/lib/auth/active-agency';
import { canSeeLeadRecord, viewerFromProfile } from '@/lib/agency/visibility';
import { parseFacadeFormat, streetViewStaticUrl } from '@/lib/facade/street-view';
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
  const googleUrl = streetViewStaticUrl(latitude, longitude, format);
  if (!googleUrl) return new NextResponse(null, { status: 503 });

  let googleRes: Response;
  try {
    googleRes = await fetch(googleUrl);
  } catch (e) {
    console.error('[facade] fetch Street View', e);
    return new NextResponse(null, { status: 502 });
  }

  if (googleRes.status === 404) return new NextResponse(null, { status: 404 });
  if (!googleRes.ok) {
    if (process.env.NODE_ENV === 'development') {
      const preview = (await googleRes.text()).slice(0, 280);
      console.error('[facade] Street View refusé', googleRes.status, preview);
    }
    return new NextResponse(null, { status: 502 });
  }

  const headers = new Headers();
  const cacheControl = googleRes.headers.get('Cache-Control');
  if (cacheControl) headers.set('Cache-Control', cacheControl);
  const contentType = googleRes.headers.get('Content-Type');
  if (contentType) headers.set('Content-Type', contentType);

  return new NextResponse(googleRes.body, { status: 200, headers });
}
