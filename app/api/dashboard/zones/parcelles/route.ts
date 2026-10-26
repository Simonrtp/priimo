import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { parcellesDansEmprise } from '@/lib/zones/parcelles-serveur';

export const runtime = 'nodejs';

/** Au-delà d'environ 2,5 km de côté, l'atelier demande de zoomer. */
const COTE_MAX_DEGRES = 0.035;

/**
 * Les contours des parcelles d'une portion de carte, pour l'atelier secteur :
 * le tracé se colore aussitôt, un clic choisit une parcelle, à tout zoom.
 */
export async function GET(req: Request) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }
  const url = new URL(req.url);
  const lire = (k: string) => Number(url.searchParams.get(k));
  const boite = { ouest: lire('ouest'), sud: lire('sud'), est: lire('est'), nord: lire('nord') };
  if (!Object.values(boite).every(Number.isFinite) || boite.est <= boite.ouest || boite.nord <= boite.sud) {
    return NextResponse.json({ error: 'Emprise invalide' }, { status: 400 });
  }
  if (boite.est - boite.ouest > COTE_MAX_DEGRES || boite.nord - boite.sud > COTE_MAX_DEGRES) {
    return NextResponse.json({ parcelles: [], tropLarge: true });
  }
  const supabase = await createSupabaseServerClient();
  try {
    const parcelles = await parcellesDansEmprise(supabase as unknown as SupabaseClient, boite, 4000);
    return NextResponse.json(
      { parcelles: parcelles.map((p) => ({ id: p.id, anneaux: p.anneaux, c: [p.longitude, p.latitude] })) },
      { headers: { 'Cache-Control': 'private, max-age=3600' } },
    );
  } catch (e) {
    console.error('[zones] parcelles de la carte', e instanceof Error ? e.message : e);
    return NextResponse.json({ parcelles: [] });
  }
}
