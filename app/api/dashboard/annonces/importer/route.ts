import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { etatImport, importerUrl } from '@/lib/annonces/import/serveur';
import { sessionImport } from '@/lib/annonces/import/session';
import { analyserUrl } from '@/lib/annonces/import/url';

export const runtime = 'nodejs';
export const maxDuration = 30;

/** Une URL collée dans le panneau Annonces → l'annonce, son adresse, le point sur la carte. */
export async function POST(req: Request) {
  const s = await sessionImport();
  if (!s) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  if (!rateLimit(`annonce-import:${s.qui.profileId}`, { limit: 30, windowMs: 60_000 }).ok) {
    return NextResponse.json({ etat: 'erreur', message: 'Trop de recherches, réessayez dans une minute' }, { status: 429 });
  }
  const body = (await req.json().catch(() => null)) as { url?: unknown } | null;
  const u = typeof body?.url === 'string' ? analyserUrl(body.url.slice(0, 2000)) : null;
  if (!u) return NextResponse.json({ etat: 'erreur', message: 'Ce n’est pas une adresse d’annonce' }, { status: 400 });
  return NextResponse.json(await importerUrl(s.admin, s.db, s.qui, u));
}

/** Où en est la lecture par le PC de la veille (?id=). */
export async function GET(req: Request) {
  const s = await sessionImport();
  if (!s) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  const id = new URL(req.url).searchParams.get('id') ?? '';
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ etat: 'erreur', message: 'Recherche introuvable' }, { status: 400 });
  return NextResponse.json(await etatImport(s.admin, s.qui, id));
}
