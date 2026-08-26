/**
 * Validation des champs d'un contact.
 *
 * Le même code sert à la saisie manuelle et à la validation d'une dictée :
 * dans les deux cas c'est l'agent qui valide, et dans les deux cas la donnée
 * doit être propre avant d'entrer en base.
 */

import type { ContactType } from '@/types/contact';

export interface ContactInputFields {
  firstName: string;
  lastName: string;
  type: ContactType;
  phone: string | null;
  email: string | null;
  secteur: string | null;
  address: string | null;
  postalCodes: string[];
  budgetMin: number | null;
  budgetMax: number | null;
  surfaceMin: number | null;
  surfaceMax: number | null;
  roomsMin: number | null;
  summary: string | null;
  recontacterLe: string | null;
}

export const EMPTY_CONTACT_INPUT: ContactInputFields = {
  firstName: '',
  lastName: '',
  type: 'autre',
  phone: null,
  email: null,
  secteur: null,
  address: null,
  postalCodes: [],
  budgetMin: null,
  budgetMax: null,
  surfaceMin: null,
  surfaceMax: null,
  roomsMin: null,
  summary: null,
  recontacterLe: null,
};

const CONTACT_TYPES: readonly ContactType[] = [
  'vendeur',
  'acquereur',
  'locataire',
  'gardien',
  'commercant',
  'autre',
];

function str(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (!s) return null;
  return s.slice(0, max);
}

function num(v: unknown, max: number): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[^\d.-]/g, ''));
  if (!Number.isFinite(n) || n < 0 || n > max) return null;
  return Math.round(n);
}

/** Codes postaux français : cinq chiffres, sans doublon. */
export function normalizePostalCodes(v: unknown): string[] {
  const raw = Array.isArray(v) ? v : typeof v === 'string' ? v.split(/[,;\s]+/) : [];
  const out = new Set<string>();
  for (const item of raw) {
    const s = String(item).trim();
    if (/^\d{5}$/.test(s)) out.add(s);
  }
  return [...out].slice(0, 20);
}

export interface ParsedContactInput {
  ok: true;
  fields: ContactInputFields;
}

export interface ContactInputError {
  ok: false;
  error: string;
}

export function parseContactInput(raw: unknown): ParsedContactInput | ContactInputError {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, error: 'Requête invalide' };
  }
  const b = raw as Record<string, unknown>;

  const firstName = str(b.firstName, 80) ?? '';
  const lastName = str(b.lastName, 80) ?? '';
  if (!firstName && !lastName) {
    return { ok: false, error: 'Le nom est obligatoire' };
  }

  const typeRaw = typeof b.type === 'string' ? b.type : 'autre';
  const type = (CONTACT_TYPES as readonly string[]).includes(typeRaw)
    ? (typeRaw as ContactType)
    : 'autre';

  const email = str(b.email, 160);
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, error: "L'adresse email n'est pas valide" };
  }

  const budgetMin = num(b.budgetMin, 100_000_000);
  const budgetMax = num(b.budgetMax, 100_000_000);
  if (budgetMin !== null && budgetMax !== null && budgetMin > budgetMax) {
    return { ok: false, error: 'Le budget minimum dépasse le maximum' };
  }

  const surfaceMin = num(b.surfaceMin, 100_000);
  const surfaceMax = num(b.surfaceMax, 100_000);
  if (surfaceMin !== null && surfaceMax !== null && surfaceMin > surfaceMax) {
    return { ok: false, error: 'La surface minimum dépasse le maximum' };
  }

  let recontacterLe: string | null = null;
  if (b.recontacterLe !== undefined && b.recontacterLe !== null && b.recontacterLe !== '') {
    if (typeof b.recontacterLe !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(b.recontacterLe.trim())) {
      return { ok: false, error: "La date de relance n'est pas valide" };
    }
    recontacterLe = b.recontacterLe.trim().slice(0, 10);
  }

  return {
    ok: true,
    fields: {
      firstName,
      lastName,
      type,
      phone: str(b.phone, 40),
      email,
      secteur: str(b.secteur, 160),
      address: str(b.address, 240),
      postalCodes: normalizePostalCodes(b.postalCodes),
      budgetMin,
      budgetMax,
      surfaceMin,
      surfaceMax,
      roomsMin: num(b.roomsMin, 50),
      summary: str(b.summary, 4000),
      recontacterLe,
    },
  };
}

export function contactFieldsToRow(
  f: ContactInputFields,
  meta: { agencyId: string; createdBy: string; source?: 'manuel' | 'vocal' | 'prospection' },
) {
  return {
    agency_id: meta.agencyId,
    created_by: meta.createdBy,
    first_name: f.firstName || null,
    last_name: f.lastName || null,
    contact_type: f.type,
    phone: f.phone,
    email: f.email,
    secteur: f.secteur,
    address: f.address,
    postal_codes: f.postalCodes,
    budget_min: f.budgetMin,
    budget_max: f.budgetMax,
    surface_min: f.surfaceMin,
    surface_max: f.surfaceMax,
    rooms_min: f.roomsMin,
    summary: f.summary,
    source: meta.source ?? 'manuel',
    assigned_to: meta.createdBy,
    assigned_by: null,
    assigned_at: null,
  };
}
