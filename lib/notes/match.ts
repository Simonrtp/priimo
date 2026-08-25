import { normalizeName, normalizePhone } from '@/lib/import/normalize';
import type { NoteLienConfiance } from '@/types/contact';

/** Score BAN au-delà duquel un rattachement immeuble est certain. */
export const BAN_LIEN_CERTAIN = 0.7;

export type MatchableContact = {
  id: string;
  agencyId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  banId: string | null;
};

export type DetectedPersonne = {
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
};

export type ContactMatch = {
  contactId: string;
  label: string;
  confiance: NoteLienConfiance;
  raison: 'telephone' | 'email' | 'nom';
};

function phonesEqual(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  const na = normalizePhone(a);
  const nb = normalizePhone(b);
  return na.length >= 10 && na === nb;
}

function emailsEqual(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  return a.trim().toLocaleLowerCase('fr') === b.trim().toLocaleLowerCase('fr');
}

function namesClose(personne: DetectedPersonne, contact: MatchableContact): boolean {
  const last = normalizeName(personne.lastName);
  const first = normalizeName(personne.firstName);
  const contactLast = normalizeName(contact.lastName);
  const contactFirst = normalizeName(contact.firstName);
  if (last && contactLast && last === contactLast) {
    if (!first || !contactFirst) return true;
    return first === contactFirst || contactFirst.startsWith(first) || first.startsWith(contactFirst);
  }
  const full = normalizeName(`${personne.firstName} ${personne.lastName}`);
  const contactFull = normalizeName(contact.fullName);
  return Boolean(full && contactFull && full === contactFull);
}

/**
 * Téléphone identique → certain.
 * Nom approchant, ou plusieurs candidats → probable, jamais silencieux.
 */
export function matchContacts(
  personne: DetectedPersonne,
  contacts: readonly MatchableContact[],
  agencyId: string,
): ContactMatch[] {
  const pool = contacts.filter((c) => c.agencyId === agencyId);
  const hits: ContactMatch[] = [];

  for (const contact of pool) {
    if (phonesEqual(personne.phone, contact.phone)) {
      hits.push({
        contactId: contact.id,
        label: contact.fullName,
        confiance: 'certain',
        raison: 'telephone',
      });
      continue;
    }
    if (emailsEqual(personne.email, contact.email)) {
      hits.push({
        contactId: contact.id,
        label: contact.fullName,
        confiance: 'certain',
        raison: 'email',
      });
      continue;
    }
    if (namesClose(personne, contact)) {
      hits.push({
        contactId: contact.id,
        label: contact.fullName,
        confiance: 'probable',
        raison: 'nom',
      });
    }
  }

  const certain = hits.filter((h) => h.confiance === 'certain');
  if (certain.length === 1) return certain;
  if (certain.length > 1) {
    return certain.map((h) => ({ ...h, confiance: 'probable' as const }));
  }
  return hits;
}

export function confianceImmeuble(banScore: number | null | undefined): NoteLienConfiance | null {
  if (typeof banScore !== 'number' || !Number.isFinite(banScore)) return null;
  if (banScore < BAN_LIEN_CERTAIN) return 'probable';
  return 'certain';
}

export function transcriptMentions(
  transcript: string,
  needles: readonly (string | null | undefined)[],
): boolean {
  const hay = normalizeName(transcript);
  if (!hay) return false;
  for (const raw of needles) {
    const needle = normalizeName(raw ?? '');
    if (needle.length < 3) continue;
    if (hay.includes(needle)) return true;
  }
  const phones = needles
    .map((n) => (n ? normalizePhone(n) : ''))
    .filter((p) => p.length >= 10);
  if (phones.length === 0) return false;
  const hayDigits = transcript.replace(/\D/g, '');
  return phones.some((p) => hayDigits.includes(p) || hayDigits.includes(p.slice(1)));
}
