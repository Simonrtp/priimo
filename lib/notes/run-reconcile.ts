import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, NoteLienInsert } from '@/types/database';
import { proposeReconciliation, type OrphanNote } from '@/lib/notes/reconcilier';

type Client = SupabaseClient<Database>;

type NoteRow = {
  id: string;
  agency_id: string;
  transcript: string | null;
};

type LienRow = {
  note_id: string;
  entite_type: OrphanNote['liens'][number]['entiteType'];
  entite_id: string;
};

/**
 * Cherche les notes orphelines de l'agence et propose des liens 'probable'.
 * N'écrit jamais un lien 'certain'.
 */
export async function reconcileOrphanNotes(
  admin: Client,
  agencyId: string,
  entity: {
    entiteType: 'contact' | 'bien';
    entiteId: string;
    needles: readonly (string | null | undefined)[];
  },
): Promise<number> {
  const { data: noteRows, error: notesError } = await admin
    .from('voice_notes')
    .select('id, agency_id, transcript')
    .eq('agency_id', agencyId)
    .eq('visibilite', 'agence')
    .not('transcript', 'is', null)
    .limit(400);

  if (notesError || !noteRows) {
    console.error('[notes] réconciliation lecture', notesError);
    return 0;
  }

  const ids = (noteRows as NoteRow[]).map((n) => n.id);
  const { data: lienRows } = ids.length
    ? await admin
        .from('note_liens')
        .select('note_id, entite_type, entite_id')
        .eq('agency_id', agencyId)
        .in('note_id', ids)
    : { data: [] as LienRow[] };

  const liensByNote = new Map<string, LienRow[]>();
  for (const lien of (lienRows ?? []) as LienRow[]) {
    const list = liensByNote.get(lien.note_id) ?? [];
    list.push(lien);
    liensByNote.set(lien.note_id, list);
  }

  const notes: OrphanNote[] = (noteRows as NoteRow[]).map((row) => ({
    id: row.id,
    agencyId: row.agency_id,
    transcript: row.transcript,
    liens: (liensByNote.get(row.id) ?? []).map((l) => ({
      entiteType: l.entite_type,
      entiteId: l.entite_id,
    })),
  }));

  const proposals = proposeReconciliation(notes, {
    agencyId,
    entiteType: entity.entiteType,
    entiteId: entity.entiteId,
    needles: entity.needles,
  });

  if (proposals.length === 0) return 0;

  const rows: NoteLienInsert[] = proposals.map((p) => ({
    note_id: p.noteId,
    agency_id: p.agencyId,
    entite_type: p.entiteType,
    entite_id: p.entiteId,
    confiance: 'probable',
    cree_par: 'reconciliation',
  }));

  const { error } = await admin.from('note_liens').insert(rows);
  if (error) {
    console.error('[notes] réconciliation écriture', error);
    return 0;
  }
  return rows.length;
}
