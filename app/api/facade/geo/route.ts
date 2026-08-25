import { NextResponse } from 'next/server';
import { fetchStreetViewImage, parseFacadeGeoParams } from '@/lib/facade/street-view';
import { getServerUser } from '@/lib/auth/getServerUser';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const { user, profile } = await getServerUser();
  if (!user || !profile) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const parsed = parseFacadeGeoParams(new URL(req.url).searchParams);
  if (!parsed) return new NextResponse(null, { status: 400 });

  return fetchStreetViewImage(parsed.latitude, parsed.longitude, parsed.format);
}
