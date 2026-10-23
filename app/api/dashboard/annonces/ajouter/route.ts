import { NextResponse } from 'next/server';
import { ajouterImport } from '@/lib/annonces/import/serveur';
import { sessionImport } from '@/lib/annonces/import/session';

export const runtime = 'nodejs';

/** « Ajouter » / « Valider » : l'annonce retrouvée rejoint les annonces de l'agence, avec l'adresse choisie s'il y en a une. */
export async function POST(req: Request) {
  const s = await sessionImport();
  if (!s) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { importId?: unknown; adresseChoisie?: unknown } | null;
  const importId = typeof body?.importId === 'string' ? body.importId : '';
  if (!/^[0-9a-f-]{36}$/i.test(importId)) return NextResponse.json({ error: 'Recherche introuvable' }, { status: 400 });
  const choix = typeof body?.adresseChoisie === 'string' ? body.adresseChoisie.slice(0, 300) : null;
  const r = await ajouterImport(s.admin, s.qui, importId, choix);
  if ('erreur' in r) return NextResponse.json({ error: r.erreur }, { status: 409 });
  return NextResponse.json(r);
}
