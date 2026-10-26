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

/**
 * Une case « téléphone » telle qu'un fichier la donne : plusieurs numéros
 * (« 06… / 01… », « ::: » chez Google), « tel: », ou un 06 dont Excel a mangé
 * le zéro (612345678). Rend les numéros dans l'ordre, le premier d'abord.
 */
export function reparerTelephones(raw: string | null | undefined): string[] {
  const texte = (raw ?? '').replace(/tel:/gi, ' ');
  const trouves = texte.match(/(?:\+|00)?\d[\d .\-()]{6,}\d/g) ?? [];
  const out: string[] = [];
  const garder = (numero: string) => {
    if (!out.some((n) => normalizePhone(n) === normalizePhone(numero))) out.push(numero);
  };
  for (const bout of trouves) {
    let chiffres = normalizePhone(bout);
    // Excel lit 0612345678 comme un nombre et garde 612345678.
    if (chiffres.length === 9 && /^[1-9]/.test(chiffres) && !bout.trim().startsWith('+')) {
      chiffres = `0${chiffres}`;
    }
    if (chiffres.length < 9) continue;
    // Deux numéros français collés par une simple espace : « 06 … 78 01 … 89 ».
    const morceaux = chiffres.match(/.{10}/g) ?? [];
    if (chiffres.length % 10 === 0 && morceaux.length > 1 && morceaux.every((m) => m.startsWith('0'))) {
      morceaux.forEach(garder);
      continue;
    }
    garder(chiffres.length === 10 && chiffres.startsWith('0') ? chiffres : bout.trim());
  }
  return out;
}

/** La première adresse email lisible d'une case (« mailto: », « <…> », plusieurs). */
export function nettoyerEmail(raw: string | null | undefined): string | null {
  const m = (raw ?? '').match(/[^\s@<>,;:"'()[\]]+@[^\s@<>,;:"'()[\]]+\.[a-z]{2,}/i);
  return m ? m[0].toLocaleLowerCase('fr') : null;
}

export function isBlankRow(values: readonly string[]): boolean {
  return values.every((v) => !v.trim());
}
