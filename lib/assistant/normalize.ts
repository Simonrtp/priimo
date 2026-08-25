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

/** Chiffres seuls — utile pour téléphones stockés avec espaces. */
export function digitsOnly(s: string): string {
  return s.replace(/\D/g, '');
}

/** Motif ilike tolérant aux espaces dans un numéro (ex. 061234 → %0%6%1%2%3%4%). */
export function phoneIlikePattern(q: string): string | null {
  const digits = digitsOnly(q);
  if (digits.length < 4) return null;
  return `%${digits.split('').join('%')}%`;
}

const SEARCH_STOPWORDS = new Set([
  'a',
  'ai',
  'as',
  'au',
  'aux',
  'avec',
  'ca',
  'ce',
  'ceci',
  'cela',
  'ces',
  'cet',
  'cette',
  'chez',
  'comme',
  'comment',
  'connais',
  'connait',
  'd',
  'dans',
  'de',
  'des',
  'dis',
  'dit',
  'donne',
  'du',
  'elle',
  'elles',
  'en',
  'est',
  'et',
  'etes',
  'etre',
  'fais',
  'fait',
  'il',
  'ils',
  'je',
  'l',
  'la',
  'le',
  'les',
  'leur',
  'leurs',
  'lui',
  'm',
  'ma',
  'mais',
  'me',
  'mes',
  'moi',
  'mon',
  'n',
  'ne',
  'nos',
  'notre',
  'nous',
  'on',
  'ont',
  'ou',
  'par',
  'pas',
  'peux',
  'plus',
  'pour',
  'pourquoi',
  'qu',
  'quand',
  'que',
  'quel',
  'quelle',
  'quelles',
  'quels',
  'quest',
  'qui',
  'quoi',
  'rien',
  's',
  'sa',
  'sais',
  'sait',
  'sans',
  'savez',
  'se',
  'ses',
  'si',
  'son',
  'sont',
  'suis',
  'sur',
  't',
  'ta',
  'te',
  'tes',
  'toi',
  'ton',
  'tu',
  'un',
  'une',
  'vos',
  'votre',
  'vous',
  'y',
]);

const STREET_TYPES = new Set([
  'allee',
  'avenue',
  'av',
  'bd',
  'blvd',
  'boulevard',
  'chemin',
  'cite',
  'cours',
  'impasse',
  'passage',
  'place',
  'quai',
  'route',
  'rue',
  'rues',
  'square',
  'villa',
  'voie',
]);

export function isStreetType(token: string): boolean {
  return STREET_TYPES.has(token);
}

/** Mots porteurs d'une recherche (hors mots-outils et types de voie seuls). */
export function significantSearchTokens(query: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const token of normalizeTexte(query).split(' ').filter(Boolean)) {
    if (token.length < 3) continue;
    if (SEARCH_STOPWORDS.has(token) || STREET_TYPES.has(token)) continue;
    if (seen.has(token)) continue;
    seen.add(token);
    out.push(token);
  }
  return out;
}

function streetPhrase(query: string): string | null {
  const parts = normalizeTexte(query).split(' ').filter(Boolean);
  const idx = parts.findIndex((p) => STREET_TYPES.has(p));
  if (idx < 0) return null;
  const tail = parts.slice(idx);
  if (!tail.slice(1).some((t) => t.length >= 3 && !SEARCH_STOPWORDS.has(t) && !STREET_TYPES.has(t))) {
    return null;
  }
  const house = idx > 0 && /^\d{1,4}[a-z]?$/.test(parts[idx - 1] ?? '') ? `${parts[idx - 1]} ` : '';
  return `${house}${tail.join(' ')}`;
}

/**
 * Motifs à chercher en base : nom de voie, tokens distinctifs.
 * Une question complète n'est jamais utilisée telle quelle.
 */
export function searchPatterns(query: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  function push(raw: string) {
    const n = normalizeTexte(raw);
    if (n.length < 2 || seen.has(n)) return;
    seen.add(n);
    out.push(n);
  }

  const street = streetPhrase(query);
  if (street) push(street);
  for (const token of significantSearchTokens(query)) push(token);

  if (out.length === 0) {
    const compact = query.trim();
    if (compact.length >= 2) push(compact);
  }

  return out.slice(0, 6);
}

export function adresseCorrespond(query: string, ...candidats: Array<string | null | undefined>): boolean {
  const q = normalizeTexte(query);
  if (q.length < 3) return false;
  const tokens = significantSearchTokens(query);
  return candidats.some((c) => {
    if (!c) return false;
    const n = normalizeTexte(c);
    if (n.includes(q) || q.includes(n)) return true;
    if (tokens.length > 0 && tokens.every((t) => n.includes(t))) return true;
    return tokens.some((t) => t.length >= 4 && n.includes(t));
  });
}

export function nomCorrespond(
  query: string,
  fullName: string,
  firstName = '',
  lastName = '',
): boolean {
  const tokens = significantSearchTokens(query);
  const fallback = normalizeTexte(query)
    .split(' ')
    .filter((t) => t.length >= 2 && !SEARCH_STOPWORDS.has(t));
  const keys = tokens.length > 0 ? tokens : fallback;
  if (keys.length === 0) return false;
  const hay = normalizeTexte(`${firstName} ${lastName} ${fullName}`);
  return keys.every((t) => hay.includes(t));
}
