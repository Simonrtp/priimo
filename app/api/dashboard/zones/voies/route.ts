import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { chercherVoies } from '@/lib/geo/ban-voie';

export const runtime = 'nodejs';

function coordonnee(raw: string | null, max: number): number | null {
  if (raw == null || raw.trim() === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) && Math.abs(n) <= max ? n : null;
}

/** Les rues qui commencent comme la saisie, au plus près de l'agence. */
export async function GET(req: Request) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }
  const params = new URL(req.url).searchParams;
  const q = params.get('q')?.trim().slice(0, 120) ?? '';
  const latitude = coordonnee(params.get('lat'), 90);
  const longitude = coordonnee(params.get('lon'), 180);
  const voies = await chercherVoies(q, {
    proche: latitude != null && longitude != null ? { latitude, longitude } : null,
  });
  return NextResponse.json({ voies }, { headers: { 'Cache-Control': 'private, max-age=300' } });
}
