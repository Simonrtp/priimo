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
