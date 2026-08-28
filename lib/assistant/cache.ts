/**
 * Cache de réponses par agence. Deux agents de la même agence posent souvent
 * la même question le même matin ; les données bougent, mais pas en un quart
 * d'heure.
 *
 * Mémoire de processus, comme le rate-limit : sur plusieurs instances chacune
 * a le sien. C'est un gain, pas une garantie — rien de fonctionnel n'en dépend.
 */

import { createHash } from 'crypto';
import { normalizeTexte } from './normalize';

export const CACHE_TTL_MS = 15 * 60 * 1000;
const MAX_ENTRIES = 500;

export type CachedAnswer = {
  reponse: string;
  sources: unknown[];
  vide: boolean;
  tokens: number;
};

type Entry = { value: CachedAnswer; expiresAt: number };

const store = new Map<string, Entry>();

/** La clé enferme l'agence : jamais de fuite d'une agence à l'autre. */
export function cacheKey(agencyId: string, question: string): string {
  const normalized = normalizeTexte(question);
  return createHash('sha256').update(`${agencyId}\u0000${normalized}`).digest('hex');
}

export function readCachedAnswer(
  agencyId: string,
  question: string,
  now = Date.now(),
): CachedAnswer | null {
  const key = cacheKey(agencyId, question);
  const hit = store.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= now) {
    store.delete(key);
    return null;
  }
  return hit.value;
}

export function writeCachedAnswer(
  agencyId: string,
  question: string,
  value: CachedAnswer,
  now = Date.now(),
): void {
  if (store.size >= MAX_ENTRIES) pruneAnswerCache(now);
  if (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next();
    if (!oldest.done) store.delete(oldest.value);
  }
  store.set(cacheKey(agencyId, question), { value, expiresAt: now + CACHE_TTL_MS });
}

export function pruneAnswerCache(now = Date.now()): void {
  for (const [key, entry] of store) {
    if (entry.expiresAt <= now) store.delete(key);
  }
}

/** Tests uniquement. */
export function clearAnswerCache(): void {
  store.clear();
}
