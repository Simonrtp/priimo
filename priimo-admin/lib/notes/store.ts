import { randomUUID } from 'crypto';
import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';

/**
 * Stockage local des notes admin (appels, rendez-vous, infos terrain).
 * L'outil étant strictement localhost et mono-utilisateur, un fichier JSON
 * dans priimo-admin/data/ suffit — pas de table Supabase nécessaire.
 * Le dossier data/ est gitignoré (peut contenir des infos clients).
 */

export type NoteEntityType = 'agency' | 'profile';

export type AdminNote = {
  id: string;
  entityType: NoteEntityType;
  entityId: string;
  text: string;
  createdAt: string;
};

const DATA_DIR = path.join(process.cwd(), 'data');
const NOTES_FILE = path.join(DATA_DIR, 'admin-notes.json');

async function readAll(): Promise<AdminNote[]> {
  try {
    const raw = await readFile(NOTES_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AdminNote[]) : [];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

async function writeAll(notes: AdminNote[]): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(NOTES_FILE, JSON.stringify(notes, null, 2), 'utf-8');
}

/** Notes d'une entité, plus récentes en premier. */
export async function getNotes(entityType: NoteEntityType, entityId: string): Promise<AdminNote[]> {
  const all = await readAll();
  return all
    .filter((n) => n.entityType === entityType && n.entityId === entityId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Toutes les notes d'un type d'entité, groupées par id d'entité (pour les tableaux). */
export async function getNotesByEntity(entityType: NoteEntityType): Promise<Map<string, AdminNote[]>> {
  const all = await readAll();
  const map = new Map<string, AdminNote[]>();
  for (const note of all) {
    if (note.entityType !== entityType) continue;
    const list = map.get(note.entityId) ?? [];
    list.push(note);
    map.set(note.entityId, list);
  }
  map.forEach((list) => {
    list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  });
  return map;
}

export async function createNote(
  entityType: NoteEntityType,
  entityId: string,
  text: string,
): Promise<AdminNote> {
  const note: AdminNote = {
    id: randomUUID(),
    entityType,
    entityId,
    text,
    createdAt: new Date().toISOString(),
  };
  const all = await readAll();
  all.push(note);
  await writeAll(all);
  return note;
}

export async function removeNote(id: string): Promise<boolean> {
  const all = await readAll();
  const next = all.filter((n) => n.id !== id);
  if (next.length === all.length) return false;
  await writeAll(next);
  return true;
}
