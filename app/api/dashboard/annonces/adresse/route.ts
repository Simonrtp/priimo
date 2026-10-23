import { NextResponse } from 'next/server';
import { choisirAdresseAnnonce } from '@/lib/annonces/import/serveur';
import { sessionImport } from '@/lib/annonces/import/session';

export const runtime = 'nodejs';

/** L'agence choisit l'une des adresses possibles d'une annonce ajoutée, ou revient à toutes (`adresse` null). */
export async function POST(req: Request) {
  const s = await sessionImport();
  if (!s) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { annonceId?: unknown; adresse?: unknown } | null;
  const annonceId = typeof body?.annonceId === 'string' ? body.annonceId : '';
  if (!/^[0-9a-f-]{36}$/i.test(annonceId)) return NextResponse.json({ error: 'Annonce introuvable' }, { status: 400 });
  const adresse = typeof body?.adresse === 'string' && body.adresse.trim() ? body.adresse.slice(0, 300) : null;
  const r = await choisirAdresseAnnonce(s.admin, s.qui, annonceId, adresse);
  if ('erreur' in r) return NextResponse.json({ error: r.erreur }, { status: 409 });
  return NextResponse.json(r);
}
