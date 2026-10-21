import { NextResponse } from 'next/server';
import { retirerAnnonceAgence } from '@/lib/annonces/import/serveur';
import { sessionImport } from '@/lib/annonces/import/session';

export const runtime = 'nodejs';

/** « Retirer de la carte » : l'annonce quitte celles de l'agence. */
export async function POST(req: Request) {
  const s = await sessionImport();
  if (!s) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { annonceId?: unknown } | null;
  const annonceId = typeof body?.annonceId === 'string' ? body.annonceId : '';
  if (!/^[0-9a-f-]{36}$/i.test(annonceId)) return NextResponse.json({ error: 'Annonce introuvable' }, { status: 400 });
  const r = await retirerAnnonceAgence(s.admin, s.qui, annonceId);
  if ('erreur' in r) return NextResponse.json({ error: r.erreur }, { status: 409 });
  return NextResponse.json({ ok: true });
}
