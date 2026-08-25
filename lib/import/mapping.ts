import { normalizeHeader } from './normalize';

export const IGNORE_COLUMN = '';

export interface ImportField {
  key: string;
  label: string;
  /** Alias déjà normalisés (sans accents, espaces, ponctuation). */
  aliases: readonly string[];
}

/**
 * Pour chaque champ Priimo, la colonne du fichier correspondante — ou vide
 * pour « à ignorer ». Une colonne non reconnue n'est jamais affectée toute seule.
 */
export function suggestMapping(
  headers: readonly string[],
  fields: readonly ImportField[],
): Record<string, string> {
  const mapping: Record<string, string> = {};
  const used = new Set<string>();

  for (const field of fields) {
    mapping[field.key] = IGNORE_COLUMN;
    const aliases = new Set(field.aliases.map(normalizeHeader));
    aliases.add(normalizeHeader(field.key));
    aliases.add(normalizeHeader(field.label));

    const match = headers.find((header) => !used.has(header) && aliases.has(normalizeHeader(header)));
    if (match) {
      mapping[field.key] = match;
      used.add(match);
    }
  }

  return mapping;
}

export function applyMapping(
  values: Record<string, string>,
  mapping: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [field, header] of Object.entries(mapping)) {
    if (!header) continue;
    out[field] = (values[header] ?? '').trim();
  }
  return out;
}

/** Champs Priimo réellement reliés à une colonne — le reste ne doit pas être écrasé. */
export function activeMappedKeys(mapping: Record<string, string>): Set<string> {
  const keys = new Set<string>();
  for (const [field, header] of Object.entries(mapping)) {
    if (!header) continue;
    if (field === 'fullName') {
      keys.add('firstName');
      keys.add('lastName');
    } else {
      keys.add(field);
    }
  }
  return keys;
}
