import type { ContactType, NoteSourceInfo } from '@/types/contact';
import { NOTE_SOURCE_LABELS } from '@/types/contact';
import type { ExtractedPersonne, NoteExtraction } from '@/lib/notes/propositions';

export const TYPED_NOTE_KINDS = [
  'note_proprietaire',
  'vendeur',
  'acquereur',
  'information',
  'autre',
] as const;

export type TypedNoteKind = (typeof TYPED_NOTE_KINDS)[number];

export const TYPED_NOTE_KIND_OPTIONS: readonly {
  value: TypedNoteKind;
  label: string;
  hint: string;
}[] = [
  { value: 'note_proprietaire', label: 'Note propriétaire', hint: 'Ce qu’il vous a dit' },
  { value: 'vendeur', label: 'Vendeur', hint: 'm², pièces, prix' },
  { value: 'acquereur', label: 'Acquéreur', hint: 'Ce qu’il cherche' },
  { value: 'information', label: 'Information', hint: 'Gardien, voisin, immeuble' },
  { value: 'autre', label: 'Autre', hint: 'Tout le reste' },
];

export const TYPED_NOTE_SOURCE_OPTIONS: readonly {
  value: NoteSourceInfo;
  label: string;
}[] = (Object.entries(NOTE_SOURCE_LABELS) as [NoteSourceInfo, string][]).map(([value, label]) => ({
  value,
  label,
}));

export type TypedNoteDraft = {
  kind: TypedNoteKind | null;
  sourceInfo: NoteSourceInfo | '';
  firstName: string;
  lastName: string;
  phone: string;
  surface: string;
  rooms: string;
  prix: string;
  secteur: string;
  body: string;
};

export const EMPTY_TYPED_NOTE_DRAFT: TypedNoteDraft = {
  kind: null,
  sourceInfo: '',
  firstName: '',
  lastName: '',
  phone: '',
  surface: '',
  rooms: '',
  prix: '',
  secteur: '',
  body: '',
};

const KIND_SET = new Set<string>(TYPED_NOTE_KINDS);
const SOURCE_SET = new Set<string>(TYPED_NOTE_SOURCE_OPTIONS.map((o) => o.value));

function readString(raw: unknown, max: number): string {
  if (typeof raw !== 'string') return '';
  return raw.trim().slice(0, max);
}

function parsePositiveInt(raw: string, max: number): number | null {
  const n = Number(raw.replace(/[^\d]/g, ''));
  if (!Number.isFinite(n) || n <= 0 || n > max) return null;
  return Math.round(n);
}

function contactTypeFor(kind: TypedNoteKind): ContactType {
  if (kind === 'acquereur') return 'acquereur';
  if (kind === 'vendeur' || kind === 'note_proprietaire') return 'vendeur';
  return 'autre';
}

function sourceFor(draft: TypedNoteDraft): NoteSourceInfo | null {
  if (draft.kind === 'note_proprietaire') return 'proprietaire';
  if (draft.sourceInfo && SOURCE_SET.has(draft.sourceInfo)) return draft.sourceInfo;
  return null;
}

function personneFrom(draft: TypedNoteDraft): ExtractedPersonne | null {
  if (!draft.kind) return null;
  const firstName = draft.firstName.trim();
  const lastName = draft.lastName.trim();
  const phone = draft.phone.trim() || null;
  if (!firstName && !lastName && !phone) return null;
  return {
    firstName,
    lastName,
    phone,
    email: null,
    type: contactTypeFor(draft.kind),
  };
}

export function showsPersonFields(kind: TypedNoteKind | null): boolean {
  return kind === 'note_proprietaire' || kind === 'vendeur' || kind === 'acquereur';
}

export function showsVendeurBien(kind: TypedNoteKind | null): boolean {
  return kind === 'vendeur';
}

export function showsAcquereurCriteria(kind: TypedNoteKind | null): boolean {
  return kind === 'acquereur';
}

export function showsSource(kind: TypedNoteKind | null): boolean {
  return kind === 'information';
}

export function parseTypedNoteDraft(raw: unknown): TypedNoteDraft | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const kindRaw = typeof row.kind === 'string' ? row.kind : '';
  if (!KIND_SET.has(kindRaw)) return null;
  const sourceRaw = typeof row.sourceInfo === 'string' ? row.sourceInfo : '';
  return {
    kind: kindRaw as TypedNoteKind,
    sourceInfo: SOURCE_SET.has(sourceRaw) ? (sourceRaw as NoteSourceInfo) : '',
    firstName: readString(row.firstName, 80),
    lastName: readString(row.lastName, 80),
    phone: readString(row.phone, 40),
    surface: readString(row.surface, 12),
    rooms: readString(row.rooms, 8),
    prix: readString(row.prix, 16),
    secteur: readString(row.secteur, 160),
    body: readString(row.body, 8000),
  };
}

export function composeTypedNote(
  draft: TypedNoteDraft,
  adresse = '',
): { transcript: string; extraction: NoteExtraction } {
  const kind = draft.kind;
  const personne = personneFrom(draft);
  const sourceInfo = kind ? sourceFor(draft) : null;
  const surface = parsePositiveInt(draft.surface, 100_000);
  const rooms = parsePositiveInt(draft.rooms, 50);
  const prix = parsePositiveInt(draft.prix, 100_000_000);
  const secteur = draft.secteur.trim() || null;
  const address = adresse.trim() || null;

  const lines: string[] = [];
  if (kind) {
    const kindLabel = TYPED_NOTE_KIND_OPTIONS.find((o) => o.value === kind)?.label ?? kind;
    const who = personne
      ? [personne.firstName, personne.lastName].filter(Boolean).join(' ')
      : '';
    lines.push(who ? `${kindLabel} · ${who}` : kindLabel);
  }
  if (sourceInfo && kind === 'information') {
    lines.push(`Source : ${NOTE_SOURCE_LABELS[sourceInfo]}`);
  }
  if (personne?.phone) lines.push(`Tél : ${personne.phone}`);

  const bienBits: string[] = [];
  if (rooms) bienBits.push(rooms <= 7 ? `T${rooms}` : `${rooms} pièces`);
  if (surface) bienBits.push(`${surface} m²`);
  if (prix) {
    bienBits.push(`${new Intl.NumberFormat('fr-FR').format(prix)} €`);
  }
  if (bienBits.length) lines.push(bienBits.join(' · '));
  if (secteur) lines.push(`Secteur : ${secteur}`);
  if (address) lines.push(`Immeuble : ${address}`);

  const body = draft.body.trim();
  if (body) {
    if (lines.length) lines.push('');
    lines.push(body);
  }

  const transcript = lines.join('\n').trim();

  return {
    transcript,
    extraction: {
      personnes: personne ? [personne] : [],
      address,
      secteur,
      prix,
      rooms,
      surface,
      sourceInfo,
      relance: null,
      promesse: null,
      rendezVous: null,
      visite: null,
    },
  };
}
