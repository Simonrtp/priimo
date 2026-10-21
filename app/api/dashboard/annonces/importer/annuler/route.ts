import { NextResponse } from 'next/server';
import { annulerLecture } from '@/lib/annonces/import/serveur';
import { sessionImport } from '@/lib/annonces/import/session';

export const runtime = 'nodejs';

/** La croix du champ URL : coupe la lecture en cours pour ce compte, tout de suite. */
export async function POST() {
  const s = await sessionImport();
  if (!s) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  annulerLecture(s.qui.profileId);
  return NextResponse.json({ ok: true });
}
