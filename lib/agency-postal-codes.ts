export const FRENCH_POSTCODE_REGEX = /^\d{5}$/;

export function isValidFrenchPostcode(code: string): boolean {
  return FRENCH_POSTCODE_REGEX.test(code.trim());
}

export function normalizeFrenchPostcode(code: string): string {
  return code.trim();
}

/** Parse et déduplique une liste de codes postaux depuis le body API. */
export function parsePostalCodesFromBody(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const codes = raw
    .filter((c): c is string => typeof c === 'string')
    .map((c) => normalizeFrenchPostcode(c))
    .filter(Boolean);
  return [...new Set(codes)];
}

export function validateAgencyPostalCodes(codes: string[]): string | null {
  if (codes.length === 0) {
    return 'Sélectionnez une adresse pour définir au moins un code postal.';
  }
  const invalid = codes.find((c) => !isValidFrenchPostcode(c));
  if (invalid) return `Code postal invalide : ${invalid}.`;
  return null;
}
