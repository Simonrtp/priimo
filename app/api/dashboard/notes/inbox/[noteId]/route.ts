import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { viewerFromProfile } from '@/lib/agency/visibility';
import { canSeeVoiceNote } from '@/lib/notes/visibility';
import { mapDbVoiceNote } from '@/lib/queries/contacts';
import { fetchContactsSafe } from '@/lib/queries/contacts';
import { fetchMembersOfMyAgency } from '@/lib/queries/agency-members';
import { mapDbNoteLien, NOTE_LIENS_SELECT } from '@/lib/notes/liens';
import { buildReviewPayload } from '@/lib/notes/build-review';
import {
  proposalsFromReview,
  rejectedKeysFromStructured,
} from '@/lib/notes/attachment-proposals';
import type { NoteExtraction } from '@/lib/notes/propositions';
import type { NoteLien, TerrainNote } from '@/types/contact';
import type { NoteLienRow, VoiceNoteRow } from '@/types/database';

export const runtime = 'nodejs';

function asExtraction(structured: unknown): NoteExtraction | null {
  if (!structured || typeof structured !== 'object') return null;
  const s = structured as Record<string, unknown>;
  if (!('personnes' in s) && !('address' in s)) return null;
  return structured as NoteExtraction;
}

export async function GET(_req: Request, ctx: { params: Promise<{ noteId: string }> }) {
  const { user, profile, agency, memberships } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { noteId } = await ctx.params;
  const supabase = await createSupabaseServerClient();
  const viewer = viewerFromProfile(profile);

  const first = await supabase
    .from('voice_notes')
    .select(
      'id, agency_id, created_by, duration_seconds, transcript, transcript_original, status, statut, visibilite, source_info, contact_id, ban_id, latitude, longitude, adresse_normalisee, assigned_to, created_at, structured, mime_type',
    )
    .eq('id', noteId)
    .maybeSingle();
  const { data: row, error } = first.error
    ? await supabase
        .from('voice_notes')
        .select(
          'id, agency_id, created_by, duration_seconds, transcript, status, statut, visibilite, source_info, contact_id, ban_id, latitude, longitude, adresse_normalisee, assigned_to, created_at, structured, mime_type',
        )
        .eq('id', noteId)
        .maybeSingle()
    : first;

  const noteRow = row as VoiceNoteRow | null;
  if (error || !noteRow) {
    return NextResponse.json({ error: 'Note introuvable' }, { status: 404 });
  }

  const visibilite = noteRow.visibilite === 'privee' ? 'privee' : 'agence';
  if (!canSeeVoiceNote(viewer, { visibilite, createdBy: noteRow.created_by })) {
    return NextResponse.json({ error: 'Note introuvable' }, { status: 404 });
  }

  const [{ data: lienRows }, members, contacts] = await Promise.all([
    supabase.from('note_liens').select(NOTE_LIENS_SELECT).eq('note_id', noteId),
    fetchMembersOfMyAgency(agency.id, memberships),
    fetchContactsSafe(supabase),
  ]);

  const liens: NoteLien[] = ((lienRows ?? []) as unknown as NoteLienRow[]).map(mapDbNoteLien);
  const names = new Map(members.map((m) => [m.id, m.fullName]));
  const mapped = mapDbVoiceNote(noteRow, {
    hasFicheLink: liens.some(
      (l) => l.entiteType === 'contact' || l.entiteType === 'bien' || l.entiteType === 'lead',
    ),
  });
  const note: TerrainNote = {
    ...mapped,
    liens,
    authorName: mapped.createdBy ? names.get(mapped.createdBy) ?? null : null,
  };

  const review = buildReviewPayload({
    voiceNoteId: note.id,
    transcript: note.transcript,
    visibilite: note.visibilite,
    extraction: asExtraction(noteRow.structured),
    extractFailed: false,
    contacts,
    agencyId: agency.id,
    geo: {
      ban_id: note.banId,
      adresse_normalisee: note.adresseNormalisee,
      geocode_score: null,
    },
  });
  const proposals = proposalsFromReview(
    review,
    liens,
    rejectedKeysFromStructured(noteRow.structured),
  );

  return NextResponse.json({
    note,
    proposals,
    isAuthor: note.createdBy === profile.id,
  });
}
