import { parseContactInput, type ContactInputFields } from '@/lib/contact-input';
import type { Contact, ContactType } from '@/types/contact';
import type { ImportField } from './mapping';
import { normalizeEmail, normalizeName, normalizePhone } from './normalize';

export const CONTACT_IMPORT_FIELDS: readonly ImportField[] = [
  { key: 'firstName', label: 'Prénom', aliases: ['prenom', 'firstname', 'first', 'givenname'] },
  {
    key: 'lastName',
    label: 'Nom',
    aliases: ['nom', 'lastname', 'last', 'surname', 'nomdefamille', 'familyname'],
  },
  {
    key: 'fullName',
    label: 'Nom complet',
    aliases: ['nomcomplet', 'fullname', 'name', 'client', 'contact', 'raison sociale', 'raisonsociale'],
  },
  {
    key: 'phone',
    label: 'Téléphone',
    aliases: ['tel', 'telephone', 'phone', 'mobile', 'portable', 'gsm', 'numerotel'],
  },
  {
    key: 'email',
    label: 'Email',
    aliases: ['email', 'mail', 'e-mail', 'courriel', 'adresseemail'],
  },
  {
    key: 'type',
    label: 'Type',
    aliases: ['type', 'qualite', 'categorie', 'role', 'profil'],
  },
  {
    key: 'secteur',
    label: 'Secteur',
    aliases: ['secteur', 'quartier', 'zone', 'secteurgeo'],
  },
  {
    key: 'address',
    label: 'Adresse',
    aliases: ['adresse', 'address', 'rue', 'voie'],
  },
  {
    key: 'budgetMin',
    label: 'Budget min',
    aliases: ['budgetmin', 'budgetminimum', 'prixmin'],
  },
  {
    key: 'budgetMax',
    label: 'Budget max',
    aliases: ['budgetmax', 'budgetmaximum', 'budget', 'prixmax'],
  },
  {
    key: 'surfaceMin',
    label: 'Surface min',
    aliases: ['surfacemin', 'surface', 'm2', 'superficie'],
  },
  {
    key: 'roomsMin',
    label: 'Pièces min',
    aliases: ['piecesmin', 'pieces', 'nbpieces', 'nbrepieces'],
  },
  {
    key: 'postalCodes',
    label: 'Codes postaux',
    aliases: ['codepostal', 'cp', 'codespostaux', 'postal'],
  },
  { key: 'summary', label: 'Résumé', aliases: ['resume', 'notes', 'commentaire', 'remarque'] },
];

export interface ContactDuplicateRef {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
}

export function interpretContactType(raw: string): ContactType {
  const s = raw
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('fr')
    .trim();
  if (/(vendeur|proprietaire|seller)/.test(s)) return 'vendeur';
  if (/(acquereur|acheteur|buyer)/.test(s)) return 'acquereur';
  if (/(locataire|tenant)/.test(s)) return 'locataire';
  if (/(gardien|concierge)/.test(s)) return 'gardien';
  if (/(commercant|commerce|commerçant)/.test(s)) return 'commercant';
  if (s === 'autre' || s === 'other') return 'autre';
  return 'autre';
}

function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: '', lastName: parts[0] ?? '' };
  return {
    firstName: parts.slice(0, -1).join(' '),
    lastName: parts[parts.length - 1] ?? '',
  };
}

export function contactFieldsFromMapped(mapped: Record<string, string>): ContactInputFields | { error: string } {
  let firstName = mapped.firstName ?? '';
  let lastName = mapped.lastName ?? '';
  if (!firstName && !lastName && mapped.fullName) {
    const split = splitFullName(mapped.fullName);
    firstName = split.firstName;
    lastName = split.lastName;
  }

  const parsed = parseContactInput({
    firstName,
    lastName,
    type: interpretContactType(mapped.type ?? ''),
    phone: mapped.phone || null,
    email: mapped.email || null,
    secteur: mapped.secteur || null,
    address: mapped.address || null,
    postalCodes: mapped.postalCodes || '',
    budgetMin: mapped.budgetMin || null,
    budgetMax: mapped.budgetMax || null,
    surfaceMin: mapped.surfaceMin || null,
    roomsMin: mapped.roomsMin || null,
    summary: mapped.summary || null,
  });

  return parsed.ok ? parsed.fields : { error: parsed.error };
}

export function nameKey(firstName: string, lastName: string): string {
  return normalizeName(`${firstName} ${lastName}`);
}

export function findContactDuplicate(
  fields: ContactInputFields,
  existing: readonly ContactDuplicateRef[],
): ContactDuplicateRef | null {
  const phone = fields.phone ? normalizePhone(fields.phone) : '';
  if (phone.length >= 8) {
    const byPhone = existing.find((c) => c.phone && normalizePhone(c.phone) === phone);
    if (byPhone) return byPhone;
  }

  const email = fields.email ? normalizeEmail(fields.email) : '';
  const name = nameKey(fields.firstName, fields.lastName);
  if (email && name) {
    const byNameEmail = existing.find(
      (c) =>
        c.email &&
        normalizeEmail(c.email) === email &&
        nameKey(c.firstName, c.lastName) === name,
    );
    if (byNameEmail) return byNameEmail;
  }

  return null;
}

export function contactToDuplicateRef(contact: Contact): ContactDuplicateRef {
  return {
    id: contact.id,
    firstName: contact.firstName,
    lastName: contact.lastName,
    phone: contact.phone,
    email: contact.email,
  };
}

export function contactToInput(contact: Contact): ContactInputFields {
  return {
    firstName: contact.firstName,
    lastName: contact.lastName,
    type: contact.type,
    phone: contact.phone,
    email: contact.email,
    secteur: contact.secteur,
    address: contact.address,
    postalCodes: contact.criteria.postalCodes,
    budgetMin: contact.criteria.budgetMin,
    budgetMax: contact.criteria.budgetMax,
    surfaceMin: contact.criteria.surfaceMin,
    surfaceMax: contact.criteria.surfaceMax,
    roomsMin: contact.criteria.roomsMin,
    summary: contact.summary,
    recontacterLe: contact.recontacterLe,
  };
}

export function mergeContactFields(
  existing: ContactInputFields,
  incoming: ContactInputFields,
  keys: ReadonlySet<string>,
): ContactInputFields {
  const next = { ...existing };
  (Object.keys(incoming) as (keyof ContactInputFields)[]).forEach((key) => {
    if (keys.has(key)) {
      (next[key] as ContactInputFields[typeof key]) = incoming[key];
    }
  });
  return next;
}

export type DuplicateStrategy = 'ignore' | 'update';

export type PlannedCreate<T> = { action: 'create'; line: number; fields: T };
export type PlannedUpdate<T, D> = { action: 'update'; line: number; fields: T; duplicate: D };
export type PlannedSkip = { action: 'skip'; line: number; reason: string };
export type PlannedRow<T, D> = PlannedCreate<T> | PlannedUpdate<T, D> | PlannedSkip;

export function planContactImport(
  rows: readonly { line: number; mapped: Record<string, string> }[],
  existing: readonly ContactDuplicateRef[],
  strategy: DuplicateStrategy,
): PlannedRow<ContactInputFields, ContactDuplicateRef>[] {
  const known: ContactDuplicateRef[] = existing.map((c) => ({ ...c }));
  const pending = new Map<string, number>();
  const plan: PlannedRow<ContactInputFields, ContactDuplicateRef>[] = [];

  for (const row of rows) {
    const parsed = contactFieldsFromMapped(row.mapped);
    if ('error' in parsed) {
      plan.push({ action: 'skip', line: row.line, reason: parsed.error });
      continue;
    }

    const duplicate = findContactDuplicate(parsed, known);
    if (duplicate) {
      if (strategy === 'ignore') {
        const inFile = duplicate.id.startsWith('pending:');
        plan.push({
          action: 'skip',
          line: row.line,
          reason: inFile
            ? 'Doublon dans le fichier'
            : `Déjà connu (${[duplicate.firstName, duplicate.lastName].filter(Boolean).join(' ') || 'sans nom'})`,
        });
        continue;
      }
      const pendingIndex = pending.get(duplicate.id);
      if (pendingIndex !== undefined) {
        const current = plan[pendingIndex];
        if (current && current.action === 'create') {
          plan[pendingIndex] = { action: 'create', line: current.line, fields: parsed };
        }
        const k = known.findIndex((x) => x.id === duplicate.id);
        if (k !== -1) {
          known[k] = {
            ...duplicate,
            firstName: parsed.firstName,
            lastName: parsed.lastName,
            phone: parsed.phone,
            email: parsed.email,
          };
        }
        plan.push({
          action: 'skip',
          line: row.line,
          reason: `Doublon dans le fichier (ligne ${current && 'line' in current ? current.line : '?'})`,
        });
        continue;
      }
      plan.push({ action: 'update', line: row.line, fields: parsed, duplicate });
      const idx = known.findIndex((k) => k.id === duplicate.id);
      if (idx !== -1) {
        known[idx] = {
          ...duplicate,
          firstName: parsed.firstName,
          lastName: parsed.lastName,
          phone: parsed.phone,
          email: parsed.email,
        };
      }
      continue;
    }

    const tempId = `pending:${row.line}`;
    pending.set(tempId, plan.length);
    known.push({
      id: tempId,
      firstName: parsed.firstName,
      lastName: parsed.lastName,
      phone: parsed.phone,
      email: parsed.email,
    });
    plan.push({ action: 'create', line: row.line, fields: parsed });
  }

  return plan;
}
