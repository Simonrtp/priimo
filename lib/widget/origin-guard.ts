/**
 * Contrôle serveur de l'origine d'une requête widget.
 *
 * Sans lui, n'importe qui pourrait embarquer le formulaire d'une agence sur
 * son propre site et lui adresser des demandes. Le paramètre `page` envoyé par
 * le script est déclaratif : il sert à tracer l'URL d'origine dans la preuve
 * de consentement, jamais à autoriser.
 */

import { hostFromOrigin, isDomainAllowed } from '@/lib/widget/domains';

export type OriginVerdict =
  | { ok: true; host: string | null; originUrl: string | null }
  | { ok: false; reason: 'domaine_non_autorise' | 'origine_absente' };

/**
 * `Origin` d'abord (envoyé sur toute requête POST cross-origin), `Referer`
 * ensuite (navigation d'iframe). Une requête sans aucun des deux vient d'un
 * client qui ne passe pas par un navigateur : elle est refusée dès qu'une
 * liste blanche existe.
 */
export function checkRequestOrigin(
  req: Request,
  allowedDomains: readonly string[],
  selfHost: string | null,
): OriginVerdict {
  const originHeader = req.headers.get('origin');
  const refererHeader = req.headers.get('referer');
  const host = hostFromOrigin(originHeader) ?? hostFromOrigin(refererHeader);

  if (!host) return { ok: false, reason: 'origine_absente' };

  // Le parcours en page complète (priimo.fr/e/xxxx) est servi par nous-mêmes.
  if (selfHost && host === selfHost) {
    return { ok: true, host, originUrl: refererHeader ?? originHeader };
  }

  if (!isDomainAllowed(host, allowedDomains)) {
    return { ok: false, reason: 'domaine_non_autorise' };
  }

  return { ok: true, host, originUrl: refererHeader ?? originHeader };
}

/**
 * URL de la page qui portait le widget, telle que déclarée par le script.
 * Conservée dans la preuve de consentement, bornée en longueur, jamais
 * utilisée pour décider d'une autorisation.
 */
export function declaredPageUrl(raw: unknown, fallback: string | null): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return fallback;
  const value = raw.trim().slice(0, 500);
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : fallback;
  } catch {
    return fallback;
  }
}
