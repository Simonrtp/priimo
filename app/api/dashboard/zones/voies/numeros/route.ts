import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { numerosDeLaVoie } from '@/lib/geo/ban-voie';

export const runtime = 'nodejs';

/**
 * Les numéros d'une rue, situés : la carte des secteurs en dessine le côté
 * pair ou impair qu'une règle retient.
 */
export async function GET(req: Request) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }
  const params = new URL(req.url).searchParams;
  const nom = params.get('nom')?.trim().slice(0, 160) ?? '';
  const codePostal = params.get('cp')?.trim() ?? '';
  if (!nom || !/^\d{5}$/.test(codePostal)) {
    return NextResponse.json({ error: 'Rue inconnue' }, { status: 400 });
  }
  const numeros = await numerosDeLaVoie({ nom, codePostal });
  return NextResponse.json(
    { numeros },
    { headers: { 'Cache-Control': 'private, max-age=86400' } },
  );
}
