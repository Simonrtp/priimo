import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getServerUser } from '@/lib/auth/getServerUser';
import { oauthPublicOrigin } from '@/lib/agenda/google-calendar';
import { exchangeCodeForTokens } from '@/lib/inbound/gmail';
import {
  GOOGLE_CONTACTS_JETON_COOKIE,
  GOOGLE_CONTACTS_JETON_DUREE_S,
  GOOGLE_CONTACTS_LECTURE_PATH,
  GOOGLE_CONTACTS_STATE_COOKIE,
  googleContactsRedirectUri,
  scellerJeton,
} from '@/lib/contacts/google-contacts';

export const runtime = 'nodejs';

/** Retour sur Contacts : l'écran d'import se rouvre et lit (ou dit pourquoi il ne peut pas). */
function retour(req: Request, etat: string) {
  return NextResponse.redirect(`${oauthPublicOrigin(req)}/dashboard/contacts?import=${etat}`);
}

export async function GET(req: Request) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) return retour(req, 'google-erreur');

  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const stateParam = url.searchParams.get('state');

  const jar = await cookies();
  const attendu = jar.get(GOOGLE_CONTACTS_STATE_COOKIE)?.value;
  jar.delete(GOOGLE_CONTACTS_STATE_COOKIE);

  if (url.searchParams.get('error')) return retour(req, 'google-refuse');
  if (!code || !stateParam || !attendu || stateParam !== attendu) return retour(req, 'google-erreur');

  try {
    const state = JSON.parse(Buffer.from(stateParam, 'base64url').toString('utf8')) as {
      agencyId?: string;
      profileId?: string;
    };
    if (state.agencyId !== agency.id || state.profileId !== profile.id) return retour(req, 'google-erreur');
  } catch {
    return retour(req, 'google-erreur');
  }

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return retour(req, 'google-erreur');

  try {
    const tokens = await exchangeCodeForTokens({
      code,
      clientId,
      clientSecret,
      redirectUri: googleContactsRedirectUri(req),
    });
    jar.set(GOOGLE_CONTACTS_JETON_COOKIE, scellerJeton(tokens.access_token), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: GOOGLE_CONTACTS_LECTURE_PATH,
      maxAge: GOOGLE_CONTACTS_JETON_DUREE_S,
    });
    return retour(req, 'google');
  } catch (err) {
    console.error('[google-contacts oauth]', err instanceof Error ? err.message : err);
    return retour(req, 'google-erreur');
  }
}
