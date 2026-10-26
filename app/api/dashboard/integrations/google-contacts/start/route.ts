import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getServerUser } from '@/lib/auth/getServerUser';
import {
  GOOGLE_CONTACTS_STATE_COOKIE,
  googleContactsAuthUrl,
  googleContactsRedirectUri,
} from '@/lib/contacts/google-contacts';

export const runtime = 'nodejs';

/** Démarre l'autorisation Google Contacts (lecture seule, une fois). */
export async function GET(req: Request) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  if (!clientId) {
    return NextResponse.json({ error: 'La connexion Google n’est pas encore disponible.' }, { status: 503 });
  }

  const redirectUri = googleContactsRedirectUri(req);
  const state = Buffer.from(
    JSON.stringify({ agencyId: agency.id, profileId: profile.id, nonce: crypto.randomUUID() }),
  ).toString('base64url');

  const jar = await cookies();
  jar.set(GOOGLE_CONTACTS_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 600,
  });

  return NextResponse.json({ url: googleContactsAuthUrl({ clientId, redirectUri, state }) });
}
