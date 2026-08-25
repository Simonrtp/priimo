import { normalizeName } from '@/lib/import/normalize';

export type NameMatchMember = {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
};

function containsPhrase(haystack: string, phrase: string): boolean {
  if (!phrase) return false;
  return (` ${haystack} `).includes(` ${phrase} `);
}

/**
 * Repère un collègue si, et seulement si, un nom de membre apparaît
 * clairement dans le texte. Ambigu ou absent → rien. Ne s'assigne jamais
 * soi-même (le contact homonyme n'est pas un destinataire).
 */
export function suggestMemberFromText(
  text: string,
  members: readonly NameMatchMember[],
  selfId?: string,
): NameMatchMember | null {
  const haystack = normalizeName(text);
  if (!haystack) return null;

  const hits = new Map<string, NameMatchMember>();

  for (const member of members) {
    if (selfId && member.id === selfId) continue;
    const full = normalizeName(member.fullName);
    const last = normalizeName(member.lastName);

    const matchedFull = full.split(' ').length >= 2 && containsPhrase(haystack, full);
    const matchedLast = last.length >= 3 && containsPhrase(haystack, last);
    if (!matchedFull && !matchedLast) continue;
    hits.set(member.id, member);
  }

  // Prénoms uniques, seulement s'il n'y a pas déjà un hit plus fort.
  if (hits.size === 0) {
    for (const member of members) {
      if (selfId && member.id === selfId) continue;
      const first = normalizeName(member.firstName);
      if (first.length < 4 || !containsPhrase(haystack, first)) continue;
      const homonyms = members.filter((m) => normalizeName(m.firstName) === first);
      if (homonyms.length !== 1) continue;
      hits.set(member.id, member);
    }
  }

  if (hits.size !== 1) return null;
  return [...hits.values()][0] ?? null;
}
