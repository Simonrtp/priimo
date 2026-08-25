import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

const BUCKET = 'voice-notes';
/** Assez pour réécouter, trop court pour être partagé utilement. */
const SIGNED_URL_TTL_SECONDS = 120;

/**
 * Rend une URL signée à durée limitée pour réécouter une dictée.
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
  const { data: signed, error: signError } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(note.storage_path, SIGNED_URL_TTL_SECONDS);

  if (signError || !signed?.signedUrl) {
    console.error('[voice] signature', signError);
    return NextResponse.json({ error: 'Lecture indisponible' }, { status: 500 });
  }

  return NextResponse.json(
    { url: signed.signedUrl, expiresInSeconds: SIGNED_URL_TTL_SECONDS },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
