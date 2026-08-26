/** Normalisation des en-têtes de fichier, indépendante de la langue d'origine. */
export function normalizeHeader(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('fr')
    .replace(/[^a-z0-9]+/g, '');
}

export function normalizeName(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('fr')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function normalizeEmail(raw: string): string {
  return raw.trim().toLocaleLowerCase('fr');
}

/** Chiffres uniquement, +33 → 0. Assez pour comparer deux numéros français. */
export function normalizePhone(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('33') && digits.length >= 11) digits = `0${digits.slice(2)}`;
  if (digits.startsWith('0033') && digits.length >= 13) digits = `0${digits.slice(4)}`;
  return digits;
}

/** Affichage FR groupé par 2, sans toucher au numéro stocké. */
export function formatPhoneDisplay(raw: string): string {
  const digits = normalizePhone(raw);
  if (digits.length === 10) {
    return `${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 6)} ${digits.slice(6, 8)} ${digits.slice(8, 10)}`;
  }
  return raw.trim();
}

export function telHref(raw: string): string {
  const digits = normalizePhone(raw);
  if (digits.length === 10 && digits.startsWith('0')) return `tel:+33${digits.slice(1)}`;
  const compact = raw.replace(/[^\d+]/g, '');
  return `tel:${compact || digits}`;
}

export function isBlankRow(values: readonly string[]): boolean {
  return values.every((v) => !v.trim());
}
