import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { prisesAudio, VOICE_BUCKET } from '@/lib/voice/storage';

export const runtime = 'nodejs';

/** Assez pour réécouter, trop court pour être partagé utilement. */
const SIGNED_URL_TTL_SECONDS = 120;

/**
 * Rend des URL signées à durée limitée pour réécouter une dictée, une par prise
 * (« Compléter la dictée » ajoute des prises).
 *
 * Trois verrous : la session doit être valide, la lecture de la ligne passe par
 * RLS (donc l'agence active), et l'URL expire au bout de deux minutes. Le
 * chemin de stockage n'est jamais renvoyé.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ voiceNoteId: string }> }) {
  const { user, agency } = await getServerUser();
  if (!user || !agency) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const { voiceNoteId } = await ctx.params;
  if (!voiceNoteId) return NextResponse.json({ error: 'Dictée inconnue' }, { status: 400 });

  // Lecture sous RLS : une note d'une autre agence est simplement introuvable.
  const supabase = await createSupabaseServerClient();
  const { data: note, error } = await supabase
    .from('voice_notes')
    .select('id, agency_id, storage_path, visibilite, created_by')
    .eq('id', voiceNoteId)
    .maybeSingle();

  if (error || !note) {
    return NextResponse.json({ error: 'Dictée introuvable' }, { status: 404 });
  }

  // Ceinture et bretelles : on revérifie l'agence avant de signer quoi que ce soit.
  if (note.agency_id !== agency.id) {
    return NextResponse.json({ error: 'Dictée introuvable' }, { status: 404 });
  }
  const visibilite = (note as { visibilite?: string }).visibilite;
  const createdBy = (note as { created_by?: string | null }).created_by;
  if (visibilite === 'privee' && createdBy !== user.id) {
    return NextResponse.json({ error: 'Dictée introuvable' }, { status: 404 });
  }

  const admin = createSupabaseAdminClient();
  const prises = await prisesAudio(admin, agency.id, note.id, note.storage_path);
  if (prises.length === 0) {
    return NextResponse.json({ error: 'Aucun audio' }, { status: 404 });
  }

  const { data: signed, error: signError } = await admin.storage
    .from(VOICE_BUCKET)
    .createSignedUrls(
      prises.map((p) => p.path),
      SIGNED_URL_TTL_SECONDS,
    );
  const urls = (signed ?? []).map((s) => s.signedUrl).filter((u): u is string => Boolean(u));

  if (signError || urls.length === 0) {
    console.error('[voice] signature', signError?.message);
    return NextResponse.json({ error: 'Lecture indisponible' }, { status: 500 });
  }

  return NextResponse.json(
    { url: urls[0], urls, expiresInSeconds: SIGNED_URL_TTL_SECONDS },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
