/** Droit d'appeler / écrire : un numéro sans accord s'affiche, il n'est pas une action. */

export const NUMERO_NON_CONSENTI = 'numéro non consenti';

export function estNumeroConsenti(consentiLe: string | null | undefined): boolean {
  return Boolean(consentiLe);
}

export function smsHref(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10 && digits.startsWith('0')) return `sms:+33${digits.slice(1)}`;
  return `sms:${raw.replace(/[^\d+]/g, '')}`;
}
