import type { NoteSourceInfo } from '@/types/contact';
import { NOTE_SOURCE_LABELS } from '@/types/contact';
import type { NoteExtraction } from '@/lib/notes/propositions';

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
  { value: 'vendeur', label: 'Vendeur', hint: 'Une vente en vue' },
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
  body: string;
};

export const EMPTY_TYPED_NOTE_DRAFT: TypedNoteDraft = {
  kind: null,
  sourceInfo: '',
  body: '',
};

const KIND_SET = new Set<string>(TYPED_NOTE_KINDS);
const SOURCE_SET = new Set<string>(TYPED_NOTE_SOURCE_OPTIONS.map((o) => o.value));

function readString(raw: unknown, max: number): string {
  if (typeof raw !== 'string') return '';
  return raw.trim().slice(0, max);
}

function sourceFor(draft: TypedNoteDraft): NoteSourceInfo | null {
  if (draft.kind !== 'information') return null;
  if (draft.sourceInfo && SOURCE_SET.has(draft.sourceInfo)) return draft.sourceInfo;
  return null;
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
    body: readString(row.body, 8000),
  };
}

const EMPTY_EXTRACTION: NoteExtraction = {
  personnes: [],
  address: null,
  secteur: null,
  prix: null,
  rooms: null,
  surface: null,
  sourceInfo: null,
  relance: null,
  promesse: null,
  rendezVous: null,
  visite: null,
};

export function composeTypedNote(
  draft: TypedNoteDraft,
  adresse = '',
): { transcript: string; extraction: NoteExtraction } {
  const kind = draft.kind;
  const sourceInfo = kind ? sourceFor(draft) : null;
  const address = adresse.trim() || null;

  const lines: string[] = [];
  if (kind) {
    const kindLabel = TYPED_NOTE_KIND_OPTIONS.find((o) => o.value === kind)?.label ?? kind;
    lines.push(kindLabel);
  }
  if (sourceInfo) {
    lines.push(`Source : ${NOTE_SOURCE_LABELS[sourceInfo]}`);
  }
  if (address) lines.push(`Immeuble : ${address}`);

  const body = draft.body.trim();
  if (body) {
    if (lines.length) lines.push('');
    lines.push(body);
  }

  return {
    transcript: lines.join('\n').trim(),
    extraction: {
      ...EMPTY_EXTRACTION,
      address,
      sourceInfo,
    },
  };
}
