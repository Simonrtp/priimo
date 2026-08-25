/** Normalisation d'adresse / nom pour un repli textuel — jamais du SQL concaténé. */

export function normalizeTexte(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('fr')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function escapeIlike(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

export function adresseCorrespond(query: string, ...candidats: Array<string | null | undefined>): boolean {
  const q = normalizeTexte(query);
  if (q.length < 3) return false;
  return candidats.some((c) => {
    if (!c) return false;
    const n = normalizeTexte(c);
    return n.includes(q) || q.includes(n);
  });
}

export function nomCorrespond(
  query: string,
  fullName: string,
  firstName = '',
  lastName = '',
): boolean {
  const tokens = normalizeTexte(query)
    .split(' ')
    .filter((t) => t.length >= 2);
  if (tokens.length === 0) return false;
  const hay = normalizeTexte(`${firstName} ${lastName} ${fullName}`);
  return tokens.every((t) => hay.includes(t));
}
