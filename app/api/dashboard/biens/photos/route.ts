import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { clientIpFromRequest, rateLimit } from '@/lib/rate-limit';
import {
  BIEN_PHOTOS_BUCKET,
  estMimeVideo,
  extensionForBienPhoto,
  isBienPhotoMime,
  resoudreMimePhoto,
  tailleMaxPourMime,
  type BienPhotoMime,
} from '@/lib/bien-photos';

export const runtime = 'nodejs';
export const maxDuration = 30;

function cheminAgenceValide(agencyId: string, path: string): boolean {
  return path.startsWith(`${agencyId}/`) && !path.includes('..');
}

/** Prépare une URL d’upload signée (photo ou vidéo). */
export async function POST(req: Request) {
  const ip = clientIpFromRequest(req);
  const limit = rateLimit(`bien-photo:${ip}`, { limit: 40, windowMs: 60 * 60 * 1000 });
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Trop de médias envoyés. Réessayez dans un instant.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec) } },
    );
  }

  const { user, agency } = await getServerUser();
  if (!user || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  let body: { mime?: unknown; size?: unknown; name?: unknown };
  try {
    body = (await req.json()) as { mime?: unknown; size?: unknown; name?: unknown };
  } catch {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }

  const mimeRaw = typeof body.mime === 'string' ? body.mime : '';
  const size = typeof body.size === 'number' ? body.size : Number(body.size);
  const name = typeof body.name === 'string' ? body.name : '';

  if (!Number.isFinite(size) || size <= 0) {
    return NextResponse.json({ error: 'Fichier invalide' }, { status: 400 });
  }

  const mimeKey = mimeRaw.split(';')[0]?.trim().toLowerCase() ?? '';
  const mime = (mimeKey === 'image/jpg' ? 'image/jpeg' : mimeKey) as BienPhotoMime;
  if (!isBienPhotoMime(mime)) {
    return NextResponse.json(
      { error: 'Formats acceptés : JPEG, PNG, WebP, MP4, WebM, MOV' },
      { status: 415 },
    );
  }

  const max = tailleMaxPourMime(mime);
  if (size > max) {
    return NextResponse.json(
      {
        error: estMimeVideo(mime)
          ? 'Vidéo trop lourde (50 Mo maximum)'
          : 'Photo trop lourde (8 Mo maximum)',
      },
      { status: 413 },
    );
  }

  const ext = extensionForBienPhoto(mime);
  if (!ext) {
    return NextResponse.json(
      { error: 'Formats acceptés : JPEG, PNG, WebP, MP4, WebM, MOV' },
      { status: 415 },
    );
  }

  // name sert à l’audit / logs légers ; le MIME déclaré est la source de vérité avant verify.
  void name;

  const path = `${agency.id}/${crypto.randomUUID()}.${ext}`;
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.storage.from(BIEN_PHOTOS_BUCKET).createSignedUploadUrl(path);

  if (error || !data?.token || !data.path) {
    console.error('[biens] signed upload', error);
    return NextResponse.json({ error: "Le média n'a pas pu être enregistré" }, { status: 500 });
  }

  const { data: pub } = admin.storage.from(BIEN_PHOTOS_BUCKET).getPublicUrl(data.path);
  if (!pub.publicUrl) {
    return NextResponse.json({ error: "Le média n'a pas pu être enregistré" }, { status: 500 });
  }

  return NextResponse.json({
    path: data.path,
    token: data.token,
    publicUrl: pub.publicUrl,
  });
}

/** Vérifie le fichier après upload direct (magic bytes) et renvoie l’URL publique. */
export async function PUT(req: Request) {
  const { user, agency } = await getServerUser();
  if (!user || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  let body: { path?: unknown };
  try {
    body = (await req.json()) as { path?: unknown };
  } catch {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }

  const path = typeof body.path === 'string' ? body.path : '';
  if (!cheminAgenceValide(agency.id, path)) {
    return NextResponse.json({ error: 'Chemin invalide' }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data: blob, error: downErr } = await admin.storage.from(BIEN_PHOTOS_BUCKET).download(path);
  if (downErr || !blob) {
    return NextResponse.json({ error: "Le média n'a pas pu être vérifié" }, { status: 400 });
  }

  const entete = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
  const resolu = resoudreMimePhoto(blob.type || '', entete, path);
  if ('error' in resolu) {
    await admin.storage.from(BIEN_PHOTOS_BUCKET).remove([path]);
    return NextResponse.json({ error: resolu.error }, { status: 415 });
  }

  const attendu = path.split('.').pop()?.toLowerCase();
  const obtenu = extensionForBienPhoto(resolu.mime);
  if (attendu && obtenu && attendu !== obtenu) {
    await admin.storage.from(BIEN_PHOTOS_BUCKET).remove([path]);
    return NextResponse.json(
      { error: 'Formats acceptés : JPEG, PNG, WebP, MP4, WebM, MOV' },
      { status: 415 },
    );
  }

  const { data: pub } = admin.storage.from(BIEN_PHOTOS_BUCKET).getPublicUrl(path);
  if (!pub.publicUrl) {
    return NextResponse.json({ error: "Le média n'a pas pu être enregistré" }, { status: 500 });
  }

  return NextResponse.json({ url: pub.publicUrl, mime: resolu.mime });
}
