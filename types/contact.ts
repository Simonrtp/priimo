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

export type PortraitCollaborateur = {
  firstName: string;
  lastName: string;
  fullName: string;
  avatarUrl: string | null;
};

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
  /** Rôle principal — celui des filtres et des couleurs. */
  type: ContactType;
  /**
   * Les autres casquettes de la même personne : une vendeuse qui cherche aussi
   * à acheter est `vendeur` + `['acquereur']`. Vide pour la plupart des fiches.
   */
  autresTypes: ContactType[];
  phone: string | null;
  /** L'agent déclare que la personne lui a communiqué ce numéro. */
  numeroCommuniqueParLaPersonne?: boolean;
  email: string | null;
  secteur: string | null;
  criteria: SearchCriteria;
  summary: string | null;
  lastInteractionAt: string | null;
  /** Date civile (YYYY-MM-DD) de relance prévue. */
  recontacterLe: string | null;
  /** Fiche suspectée d'être un doublon de celle-ci. */
  doublonDe: string | null;
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
  /** Brut d'origine, renseigné à la première correction. */
  transcriptOriginal: string | null;
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
  /** Vrai si un fichier audio existe (dictée), faux pour une note tapée. */
  hasAudio: boolean;
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
  author?: PortraitCollaborateur | null;
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
  gardien: 'Gardien',
  commercant: 'Commerçant',
  autre: 'Autre',
};

export const CONTACT_TYPE_ORDER: readonly ContactType[] = [
  'acquereur',
  'vendeur',
  'locataire',
  'gardien',
  'commercant',
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

/**
 * Quand une personne a plusieurs rôles, le principal est le plus engageant
 * pour l'agence : un vendeur apporte un mandat avant d'être un acquéreur.
 */
const PRIORITE_ROLES: readonly ContactType[] = [
  'vendeur',
  'acquereur',
  'locataire',
  'gardien',
  'commercant',
  'autre',
];

/** Tous les rôles d'une fiche, sans doublon ; « Autre » seulement s'il est seul. */
export function rolesDuContact(c: { type: ContactType; autresTypes?: readonly ContactType[] | null }): ContactType[] {
  const roles = [...new Set([c.type, ...(c.autresTypes ?? [])])].filter((r) => PRIORITE_ROLES.includes(r));
  const utiles: ContactType[] = roles.filter((r) => r !== 'autre');
  return utiles.length ? PRIORITE_ROLES.filter((r) => utiles.includes(r)) : ['autre'];
}

/** Rôles choisis → rôle principal + les autres, dans l'ordre de priorité. */
export function repartirRoles(roles: readonly ContactType[]): { type: ContactType; autresTypes: ContactType[] } {
  const tries = rolesDuContact({ type: roles[0] ?? 'autre', autresTypes: roles.slice(1) });
  return { type: tries[0] ?? 'autre', autresTypes: tries.slice(1) };
}

export function aLeRole(
  c: { type: ContactType; autresTypes?: readonly ContactType[] | null },
  role: ContactType,
): boolean {
  return c.type === role || (c.autresTypes ?? []).includes(role);
}

/** Vrai si l'un des rôles appelle des critères de recherche. */
export function rolesUsentCriteres(c: { type: ContactType; autresTypes?: readonly ContactType[] | null }): boolean {
  return rolesDuContact(c).some(typeUsesCriteria);
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
