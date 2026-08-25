import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { viewerFromProfile } from '@/lib/agency/visibility';
import { canSeeVoiceNote } from '@/lib/notes/visibility';
import { mapDbVoiceNote } from '@/lib/queries/contacts';
import { mapDbNoteLien, NOTE_LIENS_SELECT } from '@/lib/notes/liens';
import { fetchMembersOfMyAgency } from '@/lib/queries/agency-members';
import type { NoteLienEntite, NoteLien, TerrainNote } from '@/types/contact';
import type { NoteLienRow, VoiceNoteRow } from '@/types/database';

export const runtime = 'nodejs';

const TYPES: readonly NoteLienEntite[] = ['contact', 'bien', 'lead', 'immeuble'];

export async function GET(req: Request) {
  const { user, profile, agency, memberships } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const url = new URL(req.url);
  const entiteTypeRaw = url.searchParams.get('entiteType');
  const entiteId = url.searchParams.get('entiteId')?.trim() ?? '';
  const entiteType =
    entiteTypeRaw && (TYPES as readonly string[]).includes(entiteTypeRaw)
      ? (entiteTypeRaw as NoteLienEntite)
      : null;

  if (!entiteType || !entiteId) {
    return NextResponse.json({ error: 'Filtre manquant' }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const viewer = viewerFromProfile(profile);

  let noteIds: string[] = [];
  if (entiteType === 'immeuble') {
    if (entiteId.startsWith('gps:')) {
      noteIds = [entiteId.slice(4)];
    } else {
      const { data: byBan } = await supabase
        .from('voice_notes')
        .select('id')
        .eq('agency_id', agency.id)
        .eq('ban_id', entiteId);
      noteIds = (byBan ?? []).map((r) => (r as { id: string }).id);
    }
  }

  const { data: lienRows } = await supabase
    .from('note_liens')
    .select(NOTE_LIENS_SELECT)
    .eq('agency_id', agency.id)
    .eq('entite_type', entiteType)
    .eq('entite_id', entiteId);

  const liens = ((lienRows ?? []) as unknown as NoteLienRow[]).map(mapDbNoteLien);
  for (const lien of liens) {
    if (!noteIds.includes(lien.noteId)) noteIds.push(lien.noteId);
  }

  if (noteIds.length === 0) return NextResponse.json({ notes: [] as TerrainNote[] });

  const { data: noteRows } = await supabase
    .from('voice_notes')
    .select(
      'id, agency_id, created_by, duration_seconds, transcript, status, statut, visibilite, source_info, contact_id, ban_id, latitude, longitude, adresse_normalisee, assigned_to, created_at, structured, storage_path, mime_type, updated_at',
    )
    .eq('agency_id', agency.id)
    .in('id', noteIds)
    .order('created_at', { ascending: false });

  const members = await fetchMembersOfMyAgency(agency.id, memberships);
  const names = new Map(members.map((m) => [m.id, m.fullName]));

  const { data: allLiens } = await supabase
    .from('note_liens')
    .select(NOTE_LIENS_SELECT)
    .eq('agency_id', agency.id)
    .in('note_id', noteIds);

  const liensByNote = new Map<string, NoteLien[]>();
  for (const row of (allLiens ?? []) as unknown as NoteLienRow[]) {
    const lien = mapDbNoteLien(row);
    const list = liensByNote.get(lien.noteId) ?? [];
    list.push(lien);
    liensByNote.set(lien.noteId, list);
  }

  const notes: TerrainNote[] = ((noteRows ?? []) as unknown as VoiceNoteRow[])
    .map((row) => {
      const mapped = mapDbVoiceNote(row, {
        hasFicheLink: (liensByNote.get(row.id) ?? []).some(
          (l) => l.entiteType === 'contact' || l.entiteType === 'bien' || l.entiteType === 'lead',
        ),
      });
      return {
        ...mapped,
        liens: liensByNote.get(row.id) ?? [],
        authorName: mapped.createdBy ? names.get(mapped.createdBy) ?? null : null,
      };
    })
    .filter((n) => canSeeVoiceNote(viewer, { visibilite: n.visibilite, createdBy: n.createdBy }));

  return NextResponse.json({ notes });
}
