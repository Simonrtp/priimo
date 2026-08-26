import type { VoiceNote, VoiceNoteStatut } from '@/types/contact';

export type NotesInboxStatut = VoiceNoteStatut | 'tous';
export type NotesInboxScope = 'moi' | 'agence';
export type NotesInboxPeriod = 'tous' | '7j' | '30j';
export type NotesInboxRattachement = 'tous' | 'rattachees' | 'orphelines';

const DAY_MS = 86_400_000;

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('fr');
}

export function filterInboxNotes<T extends VoiceNote>(
  notes: readonly T[],
  input: {
    viewerId: string;
    statut: NotesInboxStatut;
    scope: NotesInboxScope;
    period: NotesInboxPeriod;
    rattachement: NotesInboxRattachement;
    q: string;
    now?: number;
  },
): T[] {
  const now = input.now ?? Date.now();
  const q = normalize(input.q.trim());
  const maxAge =
    input.period === '7j' ? 7 * DAY_MS : input.period === '30j' ? 30 * DAY_MS : null;

  return notes.filter((note) => {
    if (input.statut !== 'tous' && note.statut !== input.statut) return false;
    if (input.scope === 'moi' && note.createdBy !== input.viewerId) return false;
    if (input.scope === 'agence' && note.visibilite !== 'agence') return false;
    if (maxAge !== null) {
      const t = Date.parse(note.createdAt);
      if (!Number.isFinite(t) || now - t > maxAge) return false;
    }
    if (input.rattachement === 'rattachees' && !note.hasFicheLink) return false;
    if (input.rattachement === 'orphelines' && note.hasFicheLink) return false;
    if (q) {
      const hay = normalize(note.transcript ?? '');
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function recentNotesForHome<T extends VoiceNote>(
  notes: readonly T[],
  input: { viewerId: string; isDirector: boolean; limit?: number },
): T[] {
  const limit = input.limit ?? 5;
  const mine = input.isDirector
    ? notes
    : notes.filter((n) => n.createdBy === input.viewerId);
  return mine.slice(0, limit);
}
