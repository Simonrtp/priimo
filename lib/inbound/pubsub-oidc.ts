/**
 * Vérification OIDC des push Google Pub/Sub.
 * Jeton Bearer signé par Google, audience = GMAIL_PUBSUB_OIDC_AUDIENCE.
 */

import { createRemoteJWKSet, jwtVerify } from 'jose';

const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'] as const;
const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

/**
 * @returns true si le Bearer est un JWT OIDC Google valide pour l'audience configurée.
 * Ne lit jamais le corps de la requête.
 */
export async function verifyGooglePubSubOidc(
  authorizationHeader: string | null | undefined,
): Promise<boolean> {
  const audience = process.env.GMAIL_PUBSUB_OIDC_AUDIENCE?.trim();
  if (!audience) return false;
  if (!authorizationHeader?.startsWith('Bearer ')) return false;

  const token = authorizationHeader.slice('Bearer '.length).trim();
  if (!token) return false;

  try {
    const { payload } = await jwtVerify(token, GOOGLE_JWKS, {
      issuer: [...GOOGLE_ISSUERS],
      audience,
    });

    // Pub/Sub push : email du compte de service, marqué vérifié.
    if (payload.email_verified !== true && payload.email_verified !== 'true') {
      return false;
    }

    const expectedEmail = process.env.GMAIL_PUBSUB_OIDC_EMAIL?.trim();
    if (expectedEmail && payload.email !== expectedEmail) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}
