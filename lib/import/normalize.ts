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

/** Affichage FR groupé par 2 : 0678765456 → 06 78 76 54 56. Aussi en cours de saisie. */
export function formatPhoneDisplay(raw: string): string {
  if (!raw.trim()) return '';
  const digits = normalizePhone(raw).slice(0, 10);
  if (!digits) return '';
  return digits.replace(/(\d{2})(?=\d)/g, '$1 ');
}

export function formatPhoneOrNull(raw: string | null | undefined): string | null {
  if (raw == null || !raw.trim()) return null;
  return formatPhoneDisplay(raw) || null;
}

/** Partie nationale après +33 : 612345678 → 6 12 34 56 78. */
export function formatPhoneAfterCountryCode(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('33')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = digits.slice(1);
  digits = digits.slice(0, 9);
  if (!digits) return '';
  const rest = digits.slice(1).replace(/(\d{2})(?=\d)/g, '$1 ');
  return rest ? `${digits[0]} ${rest}` : digits[0];
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
