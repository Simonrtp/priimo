import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { mapDbNoteLien, NOTE_LIENS_SELECT } from '@/lib/notes/liens';
import {
  hrefRattachement,
  idsParType,
  libelleParcelle,
  nomContact,
  type RattachementAffiche,
} from '@/lib/notes/rattachement';
import type { NoteLien, NoteLienEntite, VoiceNote } from '@/types/contact';
import type { NoteLienRow } from '@/types/database';

type Db = SupabaseClient<Database>;

function etiquette(
  type: NoteLienEntite,
  id: string,
  libelles: ReadonlyMap<string, string>,
): RattachementAffiche {
  const key = `${type}:${id}`;
  const label =
    libelles.get(key) ??
    (type === 'parcelle' ? libelleParcelle(id) : `${type === 'immeuble' ? 'Immeuble' : id}`);
  return { type, id, label, href: hrefRattachement(type, id) };
}

/**
 * Libellés des rattachements, en une passe par type d'entité.
 *
 * Sans ça, la carte de lecture n'aurait que des identifiants : l'agent
 * verrait « contact:uuid » au lieu du nom, et une parcelle passerait
 * pour une note orpheline.
 */
export async function rattachementsDesNotes(params: {
  supabase: Db;
  notes: readonly VoiceNote[];
}): Promise<Map<string, RattachementAffiche[]>> {
  const ids = params.notes.map((n) => n.id);
  const parNote = new Map<string, RattachementAffiche[]>();
  for (const note of params.notes) parNote.set(note.id, []);
  if (ids.length === 0) return parNote;

  const { data: lienRows } = await params.supabase
    .from('note_liens')
    .select(NOTE_LIENS_SELECT)
    .in('note_id', ids);
  const liens = ((lienRows ?? []) as unknown as NoteLienRow[]).map(mapDbNoteLien);

  const liensParNote = new Map<string, NoteLien[]>();
  for (const lien of liens) {
    const list = liensParNote.get(lien.noteId) ?? [];
    list.push(lien);
    liensParNote.set(lien.noteId, list);
  }

  const contactIds = new Set<string>();
  const bienIds = new Set<string>();
  const leadIds = new Set<string>();
  const banIds = new Set<string>();

  for (const note of params.notes) {
    const parType = idsParType(liensParNote.get(note.id) ?? [], note.contactId);
    for (const id of parType.get('contact') ?? []) contactIds.add(id);
    for (const id of parType.get('bien') ?? []) bienIds.add(id);
    for (const id of parType.get('lead') ?? []) leadIds.add(id);
    for (const id of parType.get('immeuble') ?? []) banIds.add(id);
  }

  const libelles = new Map<string, string>();

  const lectures: Promise<void>[] = [];
  if (contactIds.size > 0) {
    lectures.push(
      (async () => {
        const { data } = await params.supabase
          .from('contacts')
          .select('id, first_name, last_name')
          .in('id', [...contactIds]);
        for (const row of data ?? []) {
          libelles.set(`contact:${row.id}`, nomContact(row.first_name, row.last_name));
        }
      })(),
    );
  }
  if (bienIds.size > 0) {
    lectures.push(
      (async () => {
        const { data } = await params.supabase.from('biens').select('id, address').in('id', [...bienIds]);
        for (const row of data ?? []) {
          libelles.set(`bien:${row.id}`, (row.address ?? '').trim() || 'Bien');
        }
      })(),
    );
  }
  if (leadIds.size > 0) {
    lectures.push(
      (async () => {
        const { data } = await params.supabase.from('leads').select('id, address').in('id', [...leadIds]);
        for (const row of data ?? []) {
          libelles.set(`lead:${row.id}`, (row.address ?? '').trim() || 'Prospect');
        }
      })(),
    );
  }
  if (banIds.size > 0) {
    lectures.push(
      (async () => {
        const { data } = await params.supabase
          .from('buildings')
          .select('ban_id, adresse')
          .in('ban_id', [...banIds]);
        for (const row of data ?? []) {
          libelles.set(`immeuble:${row.ban_id}`, (row.adresse ?? '').trim() || 'Immeuble');
        }
      })(),
    );
  }
  await Promise.all(lectures);

  for (const note of params.notes) {
    const parType = idsParType(liensParNote.get(note.id) ?? [], note.contactId);
    const list: RattachementAffiche[] = [];
    for (const [type, idsType] of parType) {
      for (const id of idsType) list.push(etiquette(type, id, libelles));
    }
    parNote.set(note.id, list);
  }

  return parNote;
}
