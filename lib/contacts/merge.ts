import type { Contact } from '@/types/contact';
import { CONTACT_TYPE_LABELS } from '@/types/contact';
import type { ContactPatch } from '@/lib/queries/contacts';

export type MergeSide = 'keep' | 'absorb';

export type MergeFieldKey =
  | 'firstName'
  | 'lastName'
  | 'type'
  | 'phone'
  | 'email'
  | 'secteur'
  | 'address'
  | 'summary'
  | 'budgetMin'
  | 'budgetMax'
  | 'surfaceMin'
  | 'surfaceMax'
  | 'roomsMin'
  | 'postalCodes'
  | 'recontacterLe'
  | 'assignedTo';

export const MERGE_FIELDS: { key: MergeFieldKey; label: string }[] = [
  { key: 'firstName', label: 'Prénom' },
  { key: 'lastName', label: 'Nom' },
  { key: 'type', label: 'Type' },
  { key: 'phone', label: 'Téléphone' },
  { key: 'email', label: 'Email' },
  { key: 'secteur', label: 'Secteur' },
  { key: 'address', label: 'Adresse' },
  { key: 'summary', label: 'Résumé' },
  { key: 'budgetMin', label: 'Budget min' },
  { key: 'budgetMax', label: 'Budget max' },
  { key: 'surfaceMin', label: 'Surface min' },
  { key: 'surfaceMax', label: 'Surface max' },
  { key: 'roomsMin', label: 'Pièces min' },
  { key: 'postalCodes', label: 'Codes postaux' },
  { key: 'recontacterLe', label: 'Relance' },
  { key: 'assignedTo', label: 'Assigné' },
];

export type MergeLinkKey =
  | 'interactions'
  | 'notes'
  | 'voiceNotes'
  | 'biens'
  | 'visites'
  | 'offres'
  | 'promesses'
  | 'rendezVous'
  | 'alerts';

export const MERGE_LINK_TARGETS: { table: string; column: string; key: MergeLinkKey }[] = [
  { table: 'contact_interactions', column: 'contact_id', key: 'interactions' },
  { table: 'voice_notes', column: 'contact_id', key: 'voiceNotes' },
  { table: 'biens', column: 'proprietaire_contact_id', key: 'biens' },
  { table: 'visites', column: 'contact_id', key: 'visites' },
  { table: 'offres', column: 'contact_id', key: 'offres' },
  { table: 'promesses', column: 'contact_id', key: 'promesses' },
  { table: 'rendez_vous', column: 'contact_id', key: 'rendezVous' },
  { table: 'agency_alerts', column: 'contact_id', key: 'alerts' },
];

export type MergeLinkCounts = Record<MergeLinkKey, number> & { notes: number };

export function emptyLinkCounts(): MergeLinkCounts {
  return {
    interactions: 0,
    notes: 0,
    voiceNotes: 0,
    biens: 0,
    visites: 0,
    offres: 0,
    promesses: 0,
    rendezVous: 0,
    alerts: 0,
  };
}

function scalar(v: string | number | null | undefined): string {
  if (v == null || v === '') return '';
  return String(v);
}

export function mergeFieldDisplay(contact: Contact, key: MergeFieldKey): string {
  switch (key) {
    case 'firstName':
      return contact.firstName;
    case 'lastName':
      return contact.lastName;
    case 'type':
      return CONTACT_TYPE_LABELS[contact.type];
    case 'phone':
      return contact.phone ?? '';
    case 'email':
      return contact.email ?? '';
    case 'secteur':
      return contact.secteur ?? '';
    case 'address':
      return contact.address ?? '';
    case 'summary':
      return contact.summary ?? '';
    case 'budgetMin':
      return scalar(contact.criteria.budgetMin);
    case 'budgetMax':
      return scalar(contact.criteria.budgetMax);
    case 'surfaceMin':
      return scalar(contact.criteria.surfaceMin);
    case 'surfaceMax':
      return scalar(contact.criteria.surfaceMax);
    case 'roomsMin':
      return scalar(contact.criteria.roomsMin);
    case 'postalCodes':
      return contact.criteria.postalCodes.join(', ');
    case 'recontacterLe':
      return contact.recontacterLe ?? '';
    case 'assignedTo':
      return contact.assignedTo ?? '';
  }
}

function hasValue(contact: Contact, key: MergeFieldKey): boolean {
  return mergeFieldDisplay(contact, key).trim().length > 0;
}

export function defaultMergeChoices(
  keep: Contact,
  absorb: Contact,
): Record<MergeFieldKey, MergeSide> {
  const out = {} as Record<MergeFieldKey, MergeSide>;
  for (const { key } of MERGE_FIELDS) {
    out[key] = hasValue(keep, key) || !hasValue(absorb, key) ? 'keep' : 'absorb';
  }
  return out;
}

export function applyMergeChoices(
  keep: Contact,
  absorb: Contact,
  choices: Partial<Record<MergeFieldKey, MergeSide>>,
): ContactPatch {
  const src = (key: MergeFieldKey): Contact =>
    choices[key] === 'absorb' ? absorb : keep;

  return {
    firstName: src('firstName').firstName,
    lastName: src('lastName').lastName,
    type: src('type').type,
    phone: src('phone').phone,
    email: src('email').email,
    secteur: src('secteur').secteur,
    address: src('address').address,
    summary: src('summary').summary,
    budgetMin: src('budgetMin').criteria.budgetMin,
    budgetMax: src('budgetMax').criteria.budgetMax,
    surfaceMin: src('surfaceMin').criteria.surfaceMin,
    surfaceMax: src('surfaceMax').criteria.surfaceMax,
    roomsMin: src('roomsMin').criteria.roomsMin,
    postalCodes: src('postalCodes').criteria.postalCodes,
    recontacterLe: src('recontacterLe').recontacterLe,
    assignedTo: src('assignedTo').assignedTo,
  };
}

export function parseMergeChoices(raw: unknown): Record<MergeFieldKey, MergeSide> | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const row = raw as Record<string, unknown>;
  const out = {} as Record<MergeFieldKey, MergeSide>;
  for (const { key } of MERGE_FIELDS) {
    const v = row[key];
    if (v !== 'keep' && v !== 'absorb') return null;
    out[key] = v;
  }
  return out;
}

export function transferredCounts(beforeKeep: MergeLinkCounts, beforeAbsorb: MergeLinkCounts): MergeLinkCounts {
  const out = emptyLinkCounts();
  for (const key of Object.keys(out) as (keyof MergeLinkCounts)[]) {
    out[key] = beforeAbsorb[key];
  }
  void beforeKeep;
  return out;
}
