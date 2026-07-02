'use server';

import { revalidatePath } from 'next/cache';
import { createNote, removeNote, type AdminNote, type NoteEntityType } from '@/lib/notes/store';

export type AddNoteResult = { ok: true; note: AdminNote } | { ok: false; error: string };

export async function addNote(
  entityType: NoteEntityType,
  entityId: string,
  text: string,
): Promise<AddNoteResult> {
  const trimmed = text.trim();
  if (!trimmed) {
    return { ok: false, error: 'La note est vide.' };
  }

  try {
    const note = await createNote(entityType, entityId, trimmed);
    revalidatePath('/', 'layout');
    return { ok: true, note };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Erreur lors de l\u2019enregistrement.' };
  }
}

export async function deleteNote(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const found = await removeNote(id);
    if (!found) return { ok: false, error: 'Note introuvable.' };
    revalidatePath('/', 'layout');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Erreur lors de la suppression.' };
  }
}
