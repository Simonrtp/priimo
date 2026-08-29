import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { AVATAR_PRESETS } from '@/lib/onboarding/parcours';

export const runtime = 'nodejs';

const BUCKET = 'avatars';
const MAX_BYTES = 2 * 1024 * 1024;

function isAllowedPreset(url: string): boolean {
  return (AVATAR_PRESETS as readonly string[]).includes(url);
}

/** Upload photo personnelle (JPEG compressé côté client). */
export async function POST(req: Request) {
  const { user, profile } = await getServerUser();
  if (!user || !profile) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

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
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Fichier trop lourd' }, { status: 400 });
  }
  const mime = file.type || 'image/jpeg';
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime)) {
    return NextResponse.json({ error: 'Format non supporté' }, { status: 400 });
  }

  const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
  const path = `${profile.id}/avatar.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const admin = createSupabaseAdminClient();
  const { error: uploadError } = await admin.storage.from(BUCKET).upload(path, buffer, {
    contentType: mime,
    upsert: true,
  });
  if (uploadError) {
    console.error('[avatar upload]', uploadError);
    return NextResponse.json({ error: 'Envoi impossible' }, { status: 500 });
  }

  const { data } = admin.storage.from(BUCKET).getPublicUrl(path);
  const url = `${data.publicUrl}?v=${Date.now()}`;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', profile.id);
  if (error) {
    return NextResponse.json({ error: 'Profil non mis à jour' }, { status: 500 });
  }

  return NextResponse.json({ url });
}

/** Choisir un preset /avatars/… ou revenir aux initiales (null). */
export async function PATCH(req: Request) {
  const { user, profile } = await getServerUser();
  if (!user || !profile) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  let raw: Record<string, unknown>;
  try {
    raw = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }

  const avatarUrl = raw.avatarUrl;
  if (avatarUrl !== null && typeof avatarUrl !== 'string') {
    return NextResponse.json({ error: 'URL invalide' }, { status: 400 });
  }

  if (typeof avatarUrl === 'string') {
    const ok =
      isAllowedPreset(avatarUrl) ||
      avatarUrl.includes('/storage/v1/object/public/avatars/');
    if (!ok) {
      return NextResponse.json({ error: 'Avatar non autorisé' }, { status: 400 });
    }
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('profiles')
    .update({ avatar_url: avatarUrl })
    .eq('id', profile.id);

  if (error) {
    return NextResponse.json({ error: 'Enregistrement impossible' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, avatarUrl });
}
