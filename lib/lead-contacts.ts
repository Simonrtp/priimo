import type { Lead } from '@/types/lead';

export type ImmeubleContactCategorie = 'commerce' | 'professionnel' | 'domicile_pro';

export type ImmeubleContact = {
  companyName: string;
  phone: string;
  nafLibelle: string | null;
  categorie: ImmeubleContactCategorie;
  siren: string | null;
  source: string | null;
};

const CATEGORIE_LABELS: Record<ImmeubleContactCategorie, string> = {
  commerce: 'Commerce',
  professionnel: 'Société',
  domicile_pro: 'Résident',
};

export function immeubleCategorieLabel(categorie: ImmeubleContactCategorie): string {
  return CATEGORIE_LABELS[categorie] ?? 'Professionnel';
}

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

function parseCategorie(value: unknown): ImmeubleContactCategorie {
  const raw = asTrimmedString(value)?.toLowerCase();
  if (raw === 'commerce' || raw === 'professionnel' || raw === 'domicile_pro') {
    return raw;
  }
  return 'professionnel';
}

/**
 * Parse défensif de `contacts_immeuble` (jsonb).
 * Ne garde que les entrées type "immeuble" avec un téléphone.
 * Respecte l'ordre du pipeline (pas de re-tri).
 */
export function parseContactsImmeuble(raw: unknown): ImmeubleContact[] {
  if (!Array.isArray(raw)) return [];

  const result: ImmeubleContact[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const obj = entry as Record<string, unknown>;
    const type = asTrimmedString(obj.type)?.toLowerCase();
    // Les "cible" restent hors liste (affichés via owner_*).
    if (type !== 'immeuble') continue;

    const phone = pickString(obj, ['telephone', 'phone', 'tel']);
    if (!phone) continue;

    // Clé pipeline principale : nom_societe
    const companyName = pickString(obj, [
      'nom_societe',
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
      categorie: parseCategorie(obj.categorie),
      siren: pickString(obj, ['siren']),
      source: pickString(obj, ['source']),
    });
  }
  return result;
}

export function hasOwnerBlock(
  lead: Pick<Lead, 'ownerName' | 'ownerCompany' | 'ownerPhone' | 'ownerAge'>,
): boolean {
  return Boolean(
    lead.ownerName?.trim() ||
      lead.ownerCompany?.trim() ||
      lead.ownerPhone?.trim() ||
      (lead.ownerAge != null && lead.ownerAge > 0),
  );
}

export function hasAnyLeadPhone(
  lead: Pick<Lead, 'ownerPhone' | 'contactsImmeuble'>,
): boolean {
  if (lead.ownerPhone?.trim()) return true;
  return lead.contactsImmeuble.some((c) => Boolean(c.phone));
}
