/**
 * Jeton du QR terrain.
 *
 * Le QR ne transporte que ça. L'empreinte poivrée est en base ; le clair
 * ne vit que dans l'URL affichée à l'agent. Une fuite de la table ne
 * reconstitue pas un QR valide.
 */

import { createHash, randomBytes } from 'node:crypto';

export const QR_TOKEN_BYTES = 18;
export const QR_SESSION_TTL_MS = 8 * 60 * 60 * 1000;
export const QR_SESSION_PLAFOND = 30;
export const QR_PATH_PREFIX = '/c/';

export function qrPepper(): string {
  const raw = process.env.QR_TOKEN_PEPPER?.trim();
  if (raw) return raw;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('QR_TOKEN_PEPPER manquant');
  }
  return 'priimo-dev-qr-pepper';
}

export function newQrToken(): string {
  return randomBytes(QR_TOKEN_BYTES).toString('base64url');
}

export function hashQrToken(token: string, pepper = qrPepper()): string {
  return createHash('sha256').update(`${pepper}\n${token}`, 'utf8').digest('hex');
}

export function isPlausibleQrToken(raw: string): boolean {
  return /^[A-Za-z0-9_-]{20,48}$/.test(raw);
}
