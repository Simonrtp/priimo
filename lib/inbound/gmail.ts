/**
 * OAuth Gmail + Pub/Sub watch.
 *
 * Scope gmail.readonly = restreint Google → vérification OAuth + audit annuel.
 * Tant que non accordé : plafond 100 users de test.
 *
 * Jetons chiffrés (AES-GCM) avec GMAIL_TOKEN_ENCRYPTION_KEY (32 bytes hex/base64).
 */

import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto';

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'] as const;

export const GMAIL_OAUTH_SCOPES = SCOPES;

export function gmailOAuthAuthUrl(args: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const params = new URLSearchParams({
    client_id: args.clientId,
    redirect_uri: args.redirectUri,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state: args.state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

function encryptionKey(): Buffer {
  const raw = process.env.GMAIL_TOKEN_ENCRYPTION_KEY?.trim();
  if (!raw) {
    throw new Error('GMAIL_TOKEN_ENCRYPTION_KEY manquante (serveur uniquement)');
  }
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex');
  return createHash('sha256').update(raw).digest();
}

export function encryptTokenPayload(payload: object): { ciphertext: Buffer; nonce: Buffer } {
  const key = encryptionKey();
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  const plain = Buffer.from(JSON.stringify(payload), 'utf8');
  const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { ciphertext: Buffer.concat([enc, tag]), nonce };
}

export function decryptTokenPayload<T = { access_token: string; refresh_token?: string }>(
  ciphertext: Buffer,
  nonce: Buffer,
): T {
  const key = encryptionKey();
  const tag = ciphertext.subarray(ciphertext.length - 16);
  const data = ciphertext.subarray(0, ciphertext.length - 16);
  const decipher = createDecipheriv('aes-256-gcm', key, nonce);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(data), decipher.final()]);
  return JSON.parse(plain.toString('utf8')) as T;
}

export async function exchangeCodeForTokens(args: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<{ access_token: string; refresh_token?: string; expires_in?: number }> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: args.code,
      client_id: args.clientId,
      client_secret: args.clientSecret,
      redirect_uri: args.redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google token exchange failed: ${text.slice(0, 300)}`);
  }
  return res.json();
}

export async function revokeGoogleToken(token: string): Promise<void> {
  await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
}

export async function refreshGoogleAccessToken(args: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
}): Promise<{ access_token: string; expires_in?: number }> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: args.refreshToken,
      client_id: args.clientId,
      client_secret: args.clientSecret,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google refresh failed: ${text.slice(0, 300)}`);
  }
  return res.json();
}

export async function fetchGmailProfile(accessToken: string): Promise<{ emailAddress: string }> {
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gmail profile failed: ${text.slice(0, 300)}`);
  }
  return res.json();
}

export const GMAIL_OAUTH_STATE_COOKIE = 'priimo_gmail_oauth_state';

/**
 * Démarre un watch Gmail → Pub/Sub (push).
 * Topic : projects/{project}/topics/{topic} (GMAIL_PUBSUB_TOPIC).
 */
export async function startGmailWatch(args: {
  accessToken: string;
  topicName: string;
}): Promise<{ historyId: string; expiration: string }> {
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/watch', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${args.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      topicName: args.topicName,
      labelIds: ['INBOX'],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gmail watch failed: ${text.slice(0, 300)}`);
  }
  const data = (await res.json()) as { historyId: string; expiration: string };
  return data;
}

export const GMAIL_VERIFICATION_NOTE =
  'gmail.readonly est un scope restreint Google. Prévoir vérification OAuth + audit ' +
  'de sécurité annuel. En attendant : max 100 utilisateurs de test.';
