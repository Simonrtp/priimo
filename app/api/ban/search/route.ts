import { NextResponse } from 'next/server';
import { searchBanDirect } from '@/lib/geo/ban';

export const runtime = 'nodejs';

/** Proxy BAN — évite les blocages fetch client vers api-adresse.data.gouv.fr. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get('q')?.trim() ?? '';
  const limitRaw = Number(url.searchParams.get('limit') ?? 5);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(1, limitRaw), 10) : 5;
  const postcode = url.searchParams.get('postcode')?.trim() ?? '';
  const autocomplete = url.searchParams.get('autocomplete') !== '0';

  if (q.length < 3) {
    return NextResponse.json({ features: [] });
  }

  try {
    const features = await searchBanDirect(q, {
      limit,
      postcode: /^\d{5}$/.test(postcode) ? postcode : undefined,
      autocomplete,
    });
    return NextResponse.json(
      { features },
      { headers: { 'Cache-Control': 'private, max-age=60' } },
    );
  } catch {
    return NextResponse.json({ features: [] });
  }
}
