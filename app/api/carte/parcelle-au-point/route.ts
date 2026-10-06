import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { estEnAttente } from '@/lib/billing/acces';
import { parcelleIdDepuisBan } from '@/lib/notes/parcelle-depuis-ban';
import { fetchParcelleAuPoint } from '@/lib/geo/cadastre-point';

export const runtime = 'nodejs';

function coordonnee(raw: string | null, max: number): number | null {
  if (raw == null || raw.trim() === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) && Math.abs(n) <= max ? n : null;
}

/**
 * L'adresse cherchée dans la barre → sa parcelle, pour ouvrir le volet sans
 * attendre que le plan cadastral soit dessiné (il est éteint par défaut).
 * D'abord l'index adresse ↔ parcelle, sinon le cadastre IGN au point.
 */
export async function GET(req: Request) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }
  if (estEnAttente(agency)) {
    return NextResponse.json({ parcelleId: null, surfaceM2: null });
  }

  const params = new URL(req.url).searchParams;
  const latitude = coordonnee(params.get('lat'), 90);
  const longitude = coordonnee(params.get('lon'), 180);
  const banId = params.get('ban')?.trim().slice(0, 64) || null;
  if (!banId && (latitude == null || longitude == null)) {
    return NextResponse.json({ error: 'Adresse inconnue' }, { status: 400 });
  }

  let parcelleId: string | null = null;
  let surfaceM2: number | null = null;
  if (banId) {
    try {
      parcelleId = await parcelleIdDepuisBan(createSupabaseAdminClient(), banId);
    } catch (err) {
      console.error('[carte] parcelle par adresse', err);
    }
  }
  if (!parcelleId && latitude != null && longitude != null) {
    const auPoint = await fetchParcelleAuPoint({ latitude, longitude });
    parcelleId = auPoint?.parcelleId ?? null;
    surfaceM2 = auPoint?.surfaceM2 ?? null;
  }

  return NextResponse.json(
    { parcelleId, surfaceM2 },
    { headers: { 'Cache-Control': 'private, max-age=600' } },
  );
}
