import type { Lead } from '@/types/lead';

export type ImmeubleContact = {
  companyName: string;
  phone: string;
  nafLibelle: string | null;
};

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = asTrimmedString(obj[key]);
    if (value) return value;
  }
  return null;
}

/**
 * Parse défensif de `contacts_immeuble` (jsonb).
 * Ne garde que les entrées type "immeuble" avec un téléphone.
 */
export function parseContactsImmeuble(raw: unknown): ImmeubleContact[] {
  if (!Array.isArray(raw)) return [];

  const result: ImmeubleContact[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const obj = entry as Record<string, unknown>;
    const type = asTrimmedString(obj.type)?.toLowerCase();
    if (type !== 'immeuble') continue;

    const phone = pickString(obj, ['telephone', 'phone', 'tel', 'owner_phone']);
    if (!phone) continue;

    const companyName = pickString(obj, [
      'societe',
      'company_name',
      'raison_sociale',
      'denomination',
      'name',
      'nom',
    ]);
    if (!companyName) continue;

    result.push({
      companyName,
      phone,
      nafLibelle: pickString(obj, ['naf_libelle', 'nafLibelle', 'activite', 'activity']),
    });
  }
  return result;
}

export function hasOwnerBlock(lead: Pick<Lead, 'ownerName' | 'ownerCompany'>): boolean {
  return Boolean(lead.ownerName?.trim() || lead.ownerCompany?.trim());
}

export function hasAnyLeadPhone(
  lead: Pick<Lead, 'ownerPhone' | 'contactsImmeuble'>,
): boolean {
  if (lead.ownerPhone?.trim()) return true;
  return lead.contactsImmeuble.some((c) => Boolean(c.phone));
}
