import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { importerTexte } from '@/lib/annonces/import/serveur';
import { sessionImport } from '@/lib/annonces/import/session';
import { analyserUrl } from '@/lib/annonces/import/url';

export const runtime = 'nodejs';
export const maxDuration = 45;

/** Repli : le texte de l'annonce collé par l'agent, lu par Mon assistant. */
export async function POST(req: Request) {
  const s = await sessionImport();
  if (!s) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  if (!rateLimit(`annonce-texte:${s.qui.profileId}`, { limit: 12, windowMs: 60_000 }).ok) {
    return NextResponse.json({ etat: 'erreur', message: 'Trop de lectures, réessayez dans une minute' }, { status: 429 });
  }
  const body = (await req.json().catch(() => null)) as { url?: unknown; texte?: unknown } | null;
  const u = typeof body?.url === 'string' ? analyserUrl(body.url.slice(0, 2000)) : null;
  const texte = typeof body?.texte === 'string' ? body.texte : '';
  if (!u) return NextResponse.json({ etat: 'erreur', message: 'Ce n’est pas une adresse d’annonce' }, { status: 400 });
  if (texte.trim().length < 40) {
    return NextResponse.json({ etat: 'erreur', message: 'Collez tout le texte de l’annonce' }, { status: 400 });
  }
  return NextResponse.json(await importerTexte(s.admin, s.qui, u, texte));
}
