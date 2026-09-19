import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { clientIpFromRequest, rateLimit } from '@/lib/rate-limit';
import { cheminLogo, deposerRapport, signerCheminRapport, supprimerRapport } from '@/lib/rapport/storage';
import { extensionMime, MAX_RAPPORT_UPLOAD_BYTES, MIME_PAGES } from '@/lib/rapport/pages';

export const runtime = 'nodejs';

export async function GET() {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }
  return NextResponse.json({ url: await signerCheminRapport(agency.logo_path) });
}

export async function POST(req: Request) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }
  if (profile.role !== 'directeur') {
    return NextResponse.json({ error: 'Réservé au directeur' }, { status: 403 });
  }
  const limit = rateLimit(`rapport-logo:${clientIpFromRequest(req)}`, {
    limit: 20,
    windowMs: 10 * 60 * 1000,
  });
  if (!limit.ok) return NextResponse.json({ error: 'Trop d’envois' }, { status: 429 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 });
  }
  if (file.size > MAX_RAPPORT_UPLOAD_BYTES) {
    return NextResponse.json({ error: 'Fichier trop lourd' }, { status: 413 });
  }
  const mime = (file.type || '').split(';')[0];
  if (!MIME_PAGES.has(mime) || mime === 'application/pdf') {
    return NextResponse.json({ error: 'Image JPEG, PNG ou WebP uniquement' }, { status: 415 });
  }

  const ext = extensionMime(mime);
  const path = cheminLogo(agency.id, ext);
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await deposerRapport(path, buffer, mime);
  if (upErr) {
    console.error('[rapport] logo', upErr);
    return NextResponse.json({ error: 'Envoi impossible' }, { status: 500 });
  }

  const session = await createSupabaseServerClient();
  const { error } = await session.from('agencies').update({ logo_path: path }).eq('id', agency.id);
  if (error) {
    return NextResponse.json({ error: 'Agence non mise à jour' }, { status: 500 });
  }

  return NextResponse.json({ path, url: await signerCheminRapport(path) });
}

export async function DELETE() {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }
  if (profile.role !== 'directeur') {
    return NextResponse.json({ error: 'Réservé au directeur' }, { status: 403 });
  }
  if (agency.logo_path) {
    await supprimerRapport(agency.logo_path);
  }
  const session = await createSupabaseServerClient();
  const { error } = await session.from('agencies').update({ logo_path: null }).eq('id', agency.id);
  if (error) {
    return NextResponse.json({ error: 'Agence non mise à jour' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
