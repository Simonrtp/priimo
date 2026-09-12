import type { VoiceNote, VoiceNoteStatut } from '@/types/contact';
import { syntheseRattachement, type RattachementAffiche } from '@/lib/notes/rattachement';

export type NotesInboxStatut = VoiceNoteStatut | 'tous';
export type NotesInboxScope = 'moi' | 'agence' | 'visibles';
export type NotesInboxPeriod = 'tous' | '7j' | '30j';
export type NotesInboxRattachement = 'tous' | 'rattachees' | 'orphelines';

const DAY_MS = 86_400_000;
const HOME_MIN_CHARS = 15;
const STOPWORDS = new Set([
  'a',
  'au',
  'aux',
  'ce',
  'de',
  'des',
  'du',
  'et',
  'il',
  'je',
  'la',
  'le',
  'les',
  'ok',
  'oui',
  'non',
  'merci',
  'thanks',
  'thank',
  'you',
  'the',
  'un',
  'une',
]);

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('fr');
}

/** Un « Thank you. » n’a rien à faire sur l’accueil. */
export function isHomeNoteWorthy(transcript: string | null | undefined): boolean {
  const raw = (transcript ?? '').trim();
  if (raw.length < HOME_MIN_CHARS) return false;
  const words = normalize(raw)
    .replace(/[^a-z0-9àâäéèêëïîôùûüç\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  return words.some((w) => w.length >= 3 && !STOPWORDS.has(w));
}

export type HomeNoteLieu = 'parcelle' | 'immeuble';

export type HomeNote = VoiceNote & {
  attachmentLabel: string | null;
  /** Lieu posé sur la note — le badge Accueil peut alors montrer une parcelle. */
  attachmentKind: HomeNoteLieu | null;
};

export function homeNoteLieuKind(
  rattachements: readonly RattachementAffiche[],
): HomeNoteLieu | null {
  const lieu = rattachements.find((r) => r.type === 'parcelle' || r.type === 'immeuble');
  return lieu?.type === 'parcelle' || lieu?.type === 'immeuble' ? lieu.type : null;
}

export function homeNoteAttachment(
  note: Pick<VoiceNote, 'contactId' | 'adresseNormalisee' | 'hasFicheLink'>,
  contactName: string | null,
  rattachements: readonly RattachementAffiche[] = [],
): string | null {
  const lieu = rattachements.find((r) => r.type === 'parcelle' || r.type === 'immeuble');
  if (lieu) {
    const extra = contactName?.trim();
    return extra && extra !== lieu.label ? `${lieu.label} · ${extra}` : lieu.label;
  }
  const name = contactName?.trim() || null;
  if (name) return name;
  const synthese = syntheseRattachement(rattachements);
  if (synthese) return synthese;
  const address = note.adresseNormalisee?.trim() || null;
  if (address) return address;
  if (note.hasFicheLink) return 'Fiche rattachée';
  return null;
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
    auteurId?: string | null;
    now?: number;
  },
): T[] {
  const now = input.now ?? Date.now();
  const q = normalize(input.q.trim());
  const maxAge =
    input.period === '7j' ? 7 * DAY_MS : input.period === '30j' ? 30 * DAY_MS : null;

  return notes.filter((note) => {
    if (input.statut !== 'tous' && note.statut !== input.statut) return false;
    if (input.auteurId && note.createdBy !== input.auteurId) return false;
    if (!input.auteurId && input.scope === 'moi' && note.createdBy !== input.viewerId) {
      return false;
    }
    if (input.scope === 'agence' && note.visibilite !== 'agence') return false;
    // `visibles` : les miennes, plus celles que les collègues ont publiées.
    // La visibilité amont (`canSeeVoiceNote`) isole déjà les privées des autres ;
    // on rejoue ici pour ne jamais les laisser passer par un oubli d'appelant.
    if (input.scope === 'visibles') {
      const mienne = note.createdBy === input.viewerId;
      if (!mienne && note.visibilite !== 'agence') return false;
    }
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
  input: { viewerId: string; isDirector: boolean; limit?: number; now?: number; weekStartKey?: string },
): T[] {
  const limit = input.limit ?? 5;
  const now = input.now ?? Date.now();
  const weekStart = input.weekStartKey ? Date.parse(`${input.weekStartKey}T00:00:00`) : now - 7 * DAY_MS;
  const mine = (
    input.isDirector
      ? notes
      : notes.filter((n) => n.createdBy === input.viewerId || n.assignedTo === input.viewerId)
  ).filter((n) => {
    if (!isHomeNoteWorthy(n.transcript)) return false;
    const t = Date.parse(n.createdAt);
    return Number.isFinite(t) && t >= weekStart;
  });
  return mine.slice(0, limit);
}
