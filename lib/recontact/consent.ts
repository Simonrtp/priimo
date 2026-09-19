/** Lien SMS à partir d'un numéro français ou international. */

export function smsHref(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10 && digits.startsWith('0')) return `sms:+33${digits.slice(1)}`;
  return `sms:${raw.replace(/[^\d+]/g, '')}`;
}
