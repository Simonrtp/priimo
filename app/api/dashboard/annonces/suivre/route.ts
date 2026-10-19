import { NextResponse } from 'next/server';
import { suivreAnnonce } from '@/lib/annonces/import/serveur';
import { sessionImport } from '@/lib/annonces/import/session';

export const runtime = 'nodejs';

async function basculer(req: Request, actif: boolean) {
  const s = await sessionImport();
  if (!s) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { annonceId?: unknown } | null;
  const annonceId = typeof body?.annonceId === 'string' ? body.annonceId : '';
  if (!/^[0-9a-f-]{36}$/i.test(annonceId)) return NextResponse.json({ error: 'Annonce introuvable' }, { status: 400 });
  const r = await suivreAnnonce(s.db, s.qui, annonceId, actif);
  if (!r.disponible) return NextResponse.json({ disponible: false }, { status: 503 });
  if (!r.ok) return NextResponse.json({ error: 'Suivi impossible' }, { status: 500 });
  return NextResponse.json({ suivie: actif });
}

/** La cloche « Suivre » : baisse de prix et retrait de cette annonce notifiés à l'agent. */
export async function POST(req: Request) {
  return basculer(req, true);
}

export async function DELETE(req: Request) {
  return basculer(req, false);
}
