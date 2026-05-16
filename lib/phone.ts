/** Numéro français : 0X XX XX XX XX ou +33X XX XX XX XX (espaces ignorés). */
export const FR_PHONE_REGEX = /^(?:\+33|0)[1-9](?:\d{2}){4}$/;

export function normalizeFrenchPhone(phone: string): string {
  return phone.replace(/\s+/g, '');
}

export function isValidFrenchPhone(phone: string): boolean {
  return FR_PHONE_REGEX.test(normalizeFrenchPhone(phone));
}

/** Normalise un numéro FR affiché en `href` tel: utilisable sur mobile. */
export function phoneToTelHref(phone: string): string | null {
  const raw = phone.trim();
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 8) return null;
  if (digits.startsWith('33')) return `tel:+${digits}`;
  if (digits.startsWith('0')) return `tel:+33${digits.slice(1)}`;
  return `tel:+${digits}`;
}
