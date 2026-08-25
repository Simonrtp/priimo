import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { extractAndBuildReview } from '@/lib/notes/extract-review';
import type { VoiceNoteVisibilite } from '@/types/contact';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Recalcule les propositions à partir du texte corrigé.
 * La note reste enregistrée même si la mise en forme échoue.
 */
export async function POST(req: Request, ctx: { params: Promise<{ voiceNoteId: string }> }) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { voiceNoteId } = await ctx.params;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }

  const transcript = typeof body.transcript === 'string' ? body.transcript : '';
  if (!transcript.trim()) {
    return NextResponse.json({ error: 'Le texte est vide' }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data: note } = await admin
    .from('voice_notes')
    .select('id, agency_id, created_by, visibilite, latitude, longitude')
    .eq('id', voiceNoteId)
    .eq('agency_id', agency.id)
    .maybeSingle();

  if (!note || note.created_by !== profile.id) {
    return NextResponse.json({ error: 'Dictée introuvable' }, { status: 404 });
  }

  const visibilite: VoiceNoteVisibilite = note.visibilite === 'privee' ? 'privee' : 'agence';
  const keepGps = note.latitude != null && note.longitude != null;

  const review = await extractAndBuildReview({
    admin,
    agencyId: agency.id,
    voiceNoteId,
    transcript,
    visibilite,
    keepGps,
  });

  return NextResponse.json(review);
}
