import { normalizeName, normalizeEmail, normalizePhone } from '@/lib/import/normalize';

export type DuplicateStrength = 'strong' | 'weak';

export type DuplicateHit<T> = {
  other: T;
  strength: DuplicateStrength;
  reason: 'telephone' | 'email' | 'nom' | 'prenom';
};

export type DuplicateFields = {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phone: string | null;
  email: string | null;
};

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = i - 1;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cur = row[j]!;
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, prev + cost);
      prev = cur;
    }
  }
  return row[b.length]!;
}

function phonesMatch(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  const na = normalizePhone(a);
  const nb = normalizePhone(b);
  return na.length >= 10 && na === nb;
}

function emailsMatch(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  return normalizeEmail(a) === normalizeEmail(b);
}

function nameScore(a: DuplicateFields, b: DuplicateFields): DuplicateStrength | null {
  const na = normalizeName(a.fullName);
  const nb = normalizeName(b.fullName);
  if (!na || !nb) return null;
  if (na === nb && a.lastName.trim() && b.lastName.trim()) return 'strong';
  const dist = levenshtein(na, nb);
  const maxLen = Math.max(na.length, nb.length);
  if (maxLen >= 6 && dist <= 2) return 'weak';
  if (maxLen >= 4 && dist <= 1) return 'weak';

  const fa = normalizeName(a.firstName);
  const fb = normalizeName(b.firstName);
  if (fa && fa === fb) {
    const la = normalizeName(a.lastName);
    const lb = normalizeName(b.lastName);
    if (!la || !lb) return 'weak';
  }
  return null;
}

export function compareDuplicates(a: DuplicateFields, b: DuplicateFields): DuplicateHit<DuplicateFields> | null {
  if (a.id === b.id) return null;
  if (phonesMatch(a.phone, b.phone)) {
    return { other: b, strength: 'strong', reason: 'telephone' };
  }
  if (emailsMatch(a.email, b.email)) {
    return { other: b, strength: 'strong', reason: 'email' };
  }
  const name = nameScore(a, b);
  if (!name) return null;
  return { other: b, strength: name, reason: name === 'strong' ? 'nom' : 'prenom' };
}

export function findDuplicates<T extends DuplicateFields>(
  candidate: DuplicateFields,
  existing: readonly T[],
): DuplicateHit<T>[] {
  const hits: DuplicateHit<T>[] = [];
  for (const other of existing) {
    const hit = compareDuplicates(candidate, other);
    if (!hit) continue;
    hits.push({ other, strength: hit.strength, reason: hit.reason });
  }
  hits.sort((a, b) => (a.strength === 'strong' && b.strength !== 'strong' ? -1 : 1));
  return hits;
}

export type DuplicatePair = {
  aId: string;
  bId: string;
  strength: DuplicateStrength;
  reason: DuplicateHit<DuplicateFields>['reason'];
};

export function pairDuplicates<T extends DuplicateFields>(contacts: readonly T[]): DuplicatePair[] {
  const phoneUsers = new Map<string, number>();
  for (const c of contacts) {
    if (!c.phone) continue;
    const n = normalizePhone(c.phone);
    if (n.length < 10) continue;
    phoneUsers.set(n, (phoneUsers.get(n) ?? 0) + 1);
  }

  const used = new Set<string>();
  const pairs: DuplicatePair[] = [];
  for (let i = 0; i < contacts.length; i++) {
    const a = contacts[i]!;
    if (used.has(a.id)) continue;
    let best: DuplicateHit<T> | null = null;
    for (let j = i + 1; j < contacts.length; j++) {
      const b = contacts[j]!;
      if (used.has(b.id)) continue;
      let hit = compareDuplicates(a, b);
      if (hit?.reason === 'telephone' && a.phone) {
        const n = normalizePhone(a.phone);
        if ((phoneUsers.get(n) ?? 0) > 2) {
          hit = compareDuplicates({ ...a, phone: null }, { ...b, phone: null });
          if (!hit) continue;
        }
      }
      if (!hit) continue;
      if (!best || (hit.strength === 'strong' && best.strength !== 'strong')) best = { ...hit, other: b };
    }
    if (!best) continue;
    used.add(a.id);
    used.add(best.other.id);
    pairs.push({
      aId: a.id,
      bId: best.other.id,
      strength: best.strength,
      reason: best.reason,
    });
  }
  return pairs;
}

export function isIncompleteContact(c: { phone: string | null; email: string | null }): boolean {
  return !c.phone?.trim() && !c.email?.trim();
}

export function isRelanceDue(recontacterLe: string | null, todayKey: string): boolean {
  if (!recontacterLe) return false;
  return recontacterLe.slice(0, 10) <= todayKey;
}

/** Date civile locale YYYY-MM-DD. */
export function civilToday(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isRelanceFuture(recontacterLe: string | null, todayKey: string): boolean {
  if (!recontacterLe) return false;
  return recontacterLe.slice(0, 10) > todayKey;
}

/** Partenaire de fusion le plus probable, y compris un `doublonDe` déjà posé. */
export function duplicatePartnerMap(
  contacts: readonly (DuplicateFields & { doublonDe?: string | null })[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const p of pairDuplicates(contacts)) {
    map.set(p.aId, p.bId);
    map.set(p.bId, p.aId);
  }
  for (const c of contacts) {
    const other = c.doublonDe;
    if (!other || map.has(c.id)) continue;
    if (!contacts.some((x) => x.id === other)) continue;
    map.set(c.id, other);
    if (!map.has(other)) map.set(other, c.id);
  }
  return map;
}
