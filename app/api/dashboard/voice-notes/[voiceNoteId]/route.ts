import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { assignmentMeta, parseAssigneeId } from '@/lib/agency/assignees';
import { fetchMembersOfMyAgency, memberIdSet } from '@/lib/queries/agency-members';
import type { NoteSourceInfo, VoiceNoteVisibilite } from '@/types/contact';
import type { VoiceNoteRow } from '@/types/database';
import { withRejectedKey } from '@/lib/notes/attachment-proposals';

export const runtime = 'nodejs';

const VIS: readonly VoiceNoteVisibilite[] = ['agence', 'privee'];
const SOURCES: readonly NoteSourceInfo[] = ['proprietaire', 'gardien', 'voisin', 'tiers', 'agent'];

const BUCKET = 'voice-notes';

/**
 * Bascule visibilité, source, relance, ou clôture de revue.
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ voiceNoteId: string }> }) {
  const { user, profile, agency, memberships } = await getServerUser();
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

  const admin = createSupabaseAdminClient();
  const { data: note } = await admin
    .from('voice_notes')
    .select('id, agency_id, created_by, structured, transcript, transcript_original')
    .eq('id', voiceNoteId)
    .eq('agency_id', agency.id)
    .maybeSingle();

  if (!note) return NextResponse.json({ error: 'Dictée introuvable' }, { status: 404 });
  if (note.created_by !== profile.id) {
    return NextResponse.json({ error: 'Dictée introuvable' }, { status: 404 });
  }

  const patch: Partial<VoiceNoteRow> = {};

  if (typeof body.transcript === 'string') {
    const next = body.transcript.trim();
    const current = typeof note.transcript === 'string' ? note.transcript : '';
    if (next !== current) {
      patch.transcript = next || null;
      if (note.transcript_original == null && current) {
        patch.transcript_original = current;
      }
    }
  }

  if (typeof body.rejectProposal === 'string' && body.rejectProposal.trim()) {
    patch.structured = withRejectedKey(note.structured, body.rejectProposal.trim());
  }

  if (typeof body.visibilite === 'string' && (VIS as readonly string[]).includes(body.visibilite)) {
    patch.visibilite = body.visibilite as VoiceNoteVisibilite;
  }
  if (body.sourceInfo === null) patch.source_info = null;
  if (typeof body.sourceInfo === 'string' && (SOURCES as readonly string[]).includes(body.sourceInfo)) {
    patch.source_info = body.sourceInfo as NoteSourceInfo;
  }
  if (body.terminer === true) patch.statut = 'revue';

  if (body.relance && typeof body.relance === 'object') {
    const relance = body.relance as Record<string, unknown>;
    const at = typeof relance.at === 'string' ? relance.at : null;
    const members = await fetchMembersOfMyAgency(agency.id, memberships);
    const assigned = parseAssigneeId(relance.assignedTo, memberIdSet(members));
    if (assigned.provided && 'invalid' in assigned) {
      return NextResponse.json(
        { error: "Cette personne n'appartient pas à l'agence" },
        { status: 400 },
      );
    }
    const assigneeId =
      assigned.provided && !('invalid' in assigned) ? assigned.id : profile.id;
    const meta = assignmentMeta(assigneeId, profile.id);
    Object.assign(patch, meta);
    const prev =
      note.structured && typeof note.structured === 'object'
        ? (note.structured as Record<string, unknown>)
        : {};
    patch.structured = { ...prev, relance: { at, assignedTo: assigneeId } };
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: true });
  }

  let { error } = await admin
    .from('voice_notes')
    .update(patch)
    .eq('id', voiceNoteId)
    .eq('agency_id', agency.id);

  if (error && patch.transcript_original !== undefined) {
    const fallback = { ...patch };
    delete fallback.transcript_original;
    const retry = await admin
      .from('voice_notes')
      .update(fallback)
      .eq('id', voiceNoteId)
      .eq('agency_id', agency.id);
    error = retry.error;
  }

  if (error) {
    console.error('[voice] patch', error);
    return NextResponse.json({ error: "La note n'a pas pu être mise à jour" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ voiceNoteId: string }> }) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { voiceNoteId } = await ctx.params;
  const admin = createSupabaseAdminClient();
  const { data: note } = await admin
    .from('voice_notes')
    .select('id, agency_id, created_by, storage_path')
    .eq('id', voiceNoteId)
    .eq('agency_id', agency.id)
    .maybeSingle();

  if (!note) return NextResponse.json({ error: 'Dictée introuvable' }, { status: 404 });
  if (note.created_by !== profile.id) {
    return NextResponse.json({ error: 'Dictée introuvable' }, { status: 404 });
  }

  if (note.storage_path && !note.storage_path.endsWith('.typed')) {
    const { error: storageError } = await admin.storage.from(BUCKET).remove([note.storage_path]);
    if (storageError) console.error('[voice] suppression audio', storageError);
  }

  const { error } = await admin
    .from('voice_notes')
    .delete()
    .eq('id', voiceNoteId)
    .eq('agency_id', agency.id)
    .eq('created_by', profile.id);

  if (error) {
    console.error('[voice] suppression', error);
    return NextResponse.json({ error: "La note n'a pas pu être supprimée" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
