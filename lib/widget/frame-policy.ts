/**
 * Politique de cadrage de la page widget.
 *
 * Le navigateur applique `frame-ancestors` : sans domaine autorisé, la page
 * n'est cadrable nulle part. C'est la première barrière ; la seconde, celle
 * qui compte vraiment, est le contrôle de l'origine côté serveur à chaque
 * requête (voir lib/widget/origin-guard.ts).
 *
 * Utilisé depuis le middleware : pas de dépendance Node, pas de client
 * Supabase — un simple appel REST, mémorisé une minute.
 */

import { frameAncestorsValue } from '@/lib/widget/domains';
import { getSupabaseServiceRoleKey, getSupabaseUrl } from '@/lib/supabase/env';

type CacheEntry = { value: string; expiresAt: number };

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, CacheEntry>();

/** Une agence désactivée, inconnue ou sans domaine ne se laisse cadrer nulle part. */
export async function frameAncestorsFor(publicId: string): Promise<string> {
  if (!/^[a-z0-9]{10,32}$/.test(publicId)) return "'none'";

  const now = Date.now();
  const hit = cache.get(publicId);
  if (hit && hit.expiresAt > now) return hit.value;

  let value = "'none'";
  try {
    const url =
      `${getSupabaseUrl()}/rest/v1/agency_widgets` +
      `?select=allowed_domains,enabled&public_id=eq.${encodeURIComponent(publicId)}&limit=1`;
    const key = getSupabaseServiceRoleKey();
    const res = await fetch(url, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: 'no-store',
    });
    if (res.ok) {
      const rows = (await res.json()) as Array<{ allowed_domains?: string[]; enabled?: boolean }>;
      const row = rows[0];
      if (row?.enabled) value = frameAncestorsValue(row.allowed_domains ?? []);
    }
  } catch {
    // Base injoignable : on refuse le cadrage plutôt que de l'ouvrir à tous.
    value = "'none'";
  }

  cache.set(publicId, { value, expiresAt: now + CACHE_TTL_MS });
  return value;
}

/** Segment `publicId` d'une URL /e/xxxx, ou null. */
export function widgetPublicIdFromPath(pathname: string): string | null {
  const match = /^\/e\/([^/?#]+)/.exec(pathname);
  return match?.[1] ?? null;
}
