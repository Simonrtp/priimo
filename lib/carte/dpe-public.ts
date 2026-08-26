/**
 * Seuil unique de fraîcheur DPE pour la couche publique.
 * Un diagnostic plus récent que ce seuil ne sort ni en point, ni en compteur, ni en popup.
 * Filtre côté serveur uniquement — modifier cette constante, une ligne.
 */
export const PUBLIC_DPE_MIN_AGE_MONTHS = 12;

export const DPE_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const;
export type DpeLetter = (typeof DPE_LETTERS)[number];

/** Palette nationale DPE (arrêté). Le orange F et le rouge G n'ont rien à voir avec l'accent leads. */
export const DPE_PALETTE: Record<DpeLetter, string> = {
  A: '#009640',
  B: '#52B153',
  C: '#C8D100',
  D: '#EEEA00',
  E: '#F7B53F',
  F: '#EB7D3B',
  G: '#D92231',
};

export function publicDpeCutoff(now: Date = new Date()): Date {
  const cutoff = new Date(now.getTime());
  cutoff.setMonth(cutoff.getMonth() - PUBLIC_DPE_MIN_AGE_MONTHS);
  return cutoff;
}

export function isPublicDpeTooRecent(dateIso: string | null | undefined, now: Date = new Date()): boolean {
  if (!dateIso) return false;
  const t = Date.parse(dateIso);
  if (!Number.isFinite(t)) return false;
  return t > publicDpeCutoff(now).getTime();
}

/** Date obligatoire et assez ancienne. Un DPE sans date n'est jamais public. */
export function isPublicDpeEligible(dateIso: string | null | undefined, now: Date = new Date()): boolean {
  if (!dateIso) return false;
  const t = Date.parse(dateIso);
  if (!Number.isFinite(t)) return false;
  return !isPublicDpeTooRecent(dateIso, now);
}

export function parseDpeLetter(raw: string | null | undefined): DpeLetter | null {
  const letter = (raw ?? '').trim().toUpperCase();
  if ((DPE_LETTERS as readonly string[]).includes(letter)) return letter as DpeLetter;
  return null;
}

export function dpeFillColor(letter: string | null | undefined): string {
  return DPE_PALETTE[parseDpeLetter(letter) ?? 'D'] ?? DPE_PALETTE.D;
}

export type PublicDiagnostic = {
  date: string | null;
  etiquette: string | null;
  type: string | null;
};

export function isDpeDiagnostic(type: string | null | undefined): boolean {
  if (!type) return true;
  return /dpe/i.test(type);
}

export function filterPublicDiagnostics<T extends PublicDiagnostic>(
  rows: readonly T[],
  now: Date = new Date(),
): T[] {
  return rows.filter((row) => {
    if (!isDpeDiagnostic(row.type) && row.type) return true;
    return isPublicDpeEligible(row.date, now);
  });
}
