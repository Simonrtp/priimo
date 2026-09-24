import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { clientIpFromRequest, rateLimit } from '@/lib/rate-limit';
import {
  BIEN_PHOTOS_BUCKET,
  BIEN_PHOTO_MAX_BYTES,
  estBlobRecu,
  extensionForBienPhoto,
  resoudreMimePhoto,
} from '@/lib/bien-photos';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: Request) {
  const ip = clientIpFromRequest(req);
  const limit = rateLimit(`bien-photo:${ip}`, { limit: 40, windowMs: 60 * 60 * 1000 });
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Trop de photos envoyées. Réessayez dans un instant.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec) } },
    );
  }

  const { user, agency } = await getServerUser();
  if (!user || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }

  const file = form.get('file');
  if (!estBlobRecu(file) || file.size === 0) {
    return NextResponse.json({ error: 'Aucune photo reçue' }, { status: 400 });
  }
  if (file.size > BIEN_PHOTO_MAX_BYTES) {
    return NextResponse.json({ error: 'Photo trop lourde (8 Mo maximum)' }, { status: 413 });
  }

  const entete = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const resolu = resoudreMimePhoto(file.type || '', entete);
  if ('error' in resolu) {
    return NextResponse.json({ error: resolu.error }, { status: 415 });
  }
  const ext = extensionForBienPhoto(resolu.mime);
  if (!ext) {
    return NextResponse.json({ error: 'Formats acceptés : JPEG, PNG, WebP' }, { status: 415 });
  }

  const path = `${agency.id}/${crypto.randomUUID()}.${ext}`;
  const admin = createSupabaseAdminClient();
  const { error: uploadError } = await admin.storage.from(BIEN_PHOTOS_BUCKET).upload(path, file, {
    contentType: resolu.mime,
    upsert: false,
  });

  if (uploadError) {
    console.error('[biens] photo upload', uploadError);
    return NextResponse.json({ error: "La photo n'a pas pu être enregistrée" }, { status: 500 });
  }

  const { data } = admin.storage.from(BIEN_PHOTOS_BUCKET).getPublicUrl(path);
  if (!data.publicUrl) {
    return NextResponse.json({ error: "La photo n'a pas pu être enregistrée" }, { status: 500 });
  }

  return NextResponse.json({ url: data.publicUrl });
}
