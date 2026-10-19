import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { reponseEnFlux } from '@/lib/annonces/import/flux';
import { importerUrl } from '@/lib/annonces/import/serveur';
import { sessionImport } from '@/lib/annonces/import/session';
import { analyserUrl } from '@/lib/annonces/import/url';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Une URL collée dans le panneau Annonces → l'annonce, son adresse, le point
 * sur la carte. Réponse en flux : chaque étape s'affiche dès qu'elle est faite.
 */
export async function POST(req: Request) {
  const s = await sessionImport();
  if (!s) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  if (!rateLimit(`annonce-import:${s.qui.profileId}`, { limit: 10, windowMs: 60_000 }).ok) {
    return NextResponse.json({ etat: 'erreur', message: 'Trop de recherches, réessayez dans une minute' }, { status: 429 });
  }
  const body = (await req.json().catch(() => null)) as { url?: unknown } | null;
  const u = typeof body?.url === 'string' ? analyserUrl(body.url.slice(0, 2000)) : null;
  if (!u) return NextResponse.json({ etat: 'erreur', message: 'Ce n’est pas une adresse d’annonce' }, { status: 400 });
  return reponseEnFlux((onEtape) => importerUrl(s.admin, s.db, s.qui, u, onEtape));
}
