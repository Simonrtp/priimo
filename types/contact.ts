import type {
  ContactInteractionKindDb,
  ContactSourceDb,
  ContactTypeDb,
  NoteLienConfianceDb,
  NoteLienCreeParDb,
  NoteLienEntiteDb,
  NoteSourceInfoDb,
  VoiceNoteStatusDb,
  VoiceNoteStatutDb,
  VoiceNoteVisibiliteDb,
} from '@/types/database';

export type ContactType = ContactTypeDb;
export type ContactSource = ContactSourceDb;
export type VoiceNoteStatus = VoiceNoteStatusDb;
export type VoiceNoteVisibilite = VoiceNoteVisibiliteDb;
export type VoiceNoteStatut = VoiceNoteStatutDb;
export type NoteSourceInfo = NoteSourceInfoDb;
export type NoteLienEntite = NoteLienEntiteDb;
export type NoteLienConfiance = NoteLienConfianceDb;
export type NoteLienCreePar = NoteLienCreeParDb;
export type InteractionKind = ContactInteractionKindDb;

/** Critères de recherche d'un acquéreur ou d'un locataire. Tout est optionnel. */
export interface SearchCriteria {
  budgetMin: number | null;
  budgetMax: number | null;
  surfaceMin: number | null;
  surfaceMax: number | null;
  roomsMin: number | null;
  postalCodes: string[];
}

export interface Contact {
  id: string;
  agencyId: string;
  createdBy: string | null;
  firstName: string;
  lastName: string;
  /** Prénom + nom nettoyé, ou l'un des deux si l'autre manque. */
  fullName: string;
  type: ContactType;
  phone: string | null;
  email: string | null;
  secteur: string | null;
  criteria: SearchCriteria;
  summary: string | null;
  lastInteractionAt: string | null;
  source: ContactSource;
  /** Adresse brute saisie — source du géocodage BAN. */
  address: string | null;
  banId: string | null;
  latitude: number | null;
  longitude: number | null;
  leadId: string | null;
  assignedTo: string | null;
  assignedBy: string | null;
  assignedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContactInteraction {
  id: string;
  contactId: string;
  authorId: string | null;
  kind: InteractionKind;
  body: string;
  voiceNoteId: string | null;
  occurredAt: string;
  assignedTo: string | null;
  assignedBy: string | null;
}

export interface VoiceNote {
  id: string;
  agencyId: string;
  createdBy: string | null;
  durationSeconds: number | null;
  transcript: string | null;
  status: VoiceNoteStatus;
  statut: VoiceNoteStatut;
  visibilite: VoiceNoteVisibilite;
  sourceInfo: NoteSourceInfo | null;
  contactId: string | null;
  banId: string | null;
  latitude: number | null;
  longitude: number | null;
  adresseNormalisee: string | null;
  assignedTo: string | null;
  postalCode: string | null;
  createdAt: string;
  /** Vrai si un lien contact / bien / lead existe — la note n'est plus orpheline. */
  hasFicheLink: boolean;
}

export interface NoteLien {
  id: string;
  noteId: string;
  agencyId: string;
  entiteType: NoteLienEntite;
  entiteId: string;
  confiance: NoteLienConfiance;
  creePar: NoteLienCreePar;
  creeLe: string;
}

export type TerrainNote = VoiceNote & {
  liens: NoteLien[];
  authorName: string | null;
};

export const NOTE_SOURCE_LABELS: Record<NoteSourceInfo, string> = {
  proprietaire: 'Propriétaire',
  gardien: 'Gardien',
  voisin: 'Voisin',
  tiers: 'Tiers',
  agent: 'Agent',
};

export const NOTE_CONFIANCE_LABELS: Record<NoteLienConfiance, string> = {
  certain: 'Certain',
  probable: 'Probable',
};

export const CONTACT_TYPE_LABELS: Record<ContactType, string> = {
  vendeur: 'Vendeur',
  acquereur: 'Acquéreur',
  locataire: 'Locataire',
  autre: 'Autre',
};

export const CONTACT_TYPE_ORDER: readonly ContactType[] = [
  'acquereur',
  'vendeur',
  'locataire',
  'autre',
];

export const INTERACTION_KIND_LABELS: Record<InteractionKind, string> = {
  note: 'Note',
  appel: 'Appel',
  visite: 'Visite',
  vocal: 'Dictée',
  email: 'Email',
};

/** Vrai si le type de contact appelle des critères de recherche. */
export function typeUsesCriteria(type: ContactType): boolean {
  return type === 'acquereur' || type === 'locataire';
}

/** Vrai si aucun critère n'est renseigné — sert à afficher « à compléter ». */
export function criteriaAreEmpty(c: SearchCriteria): boolean {
  return (
    c.budgetMin === null &&
    c.budgetMax === null &&
    c.surfaceMin === null &&
    c.surfaceMax === null &&
    c.roomsMin === null &&
    c.postalCodes.length === 0
  );
}
