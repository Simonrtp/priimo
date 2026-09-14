import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getServerUser } from '@/lib/auth/getServerUser';
import {
  CALENDAR_OAUTH_STATE_COOKIE,
  CALENDAR_VERIFICATION_NOTE,
  calendarOAuthAuthUrl,
  calendarOAuthRedirectUri,
} from '@/lib/agenda/google-calendar';

export const runtime = 'nodejs';

/**
 * Démarre OAuth Google Agenda (calendar.readonly).
 * Pas de login_hint : Google affiche le choix de compte.
 */
export async function GET(req: Request) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const redirectUri = calendarOAuthRedirectUri(req);
  if (!clientId || !redirectUri) {
    return NextResponse.json(
      {
        error: 'OAuth Google non configuré (GOOGLE_OAUTH_CLIENT_ID / redirect Agenda)',
        note: CALENDAR_VERIFICATION_NOTE,
      },
      { status: 503 },
    );
  }

  const next = new URL(req.url).searchParams.get('next') === 'settings' ? 'settings' : 'dashboard';
  const nonce = crypto.randomUUID();
  const state = Buffer.from(
    JSON.stringify({ agencyId: agency.id, profileId: profile.id, nonce, next }),
  ).toString('base64url');

  const jar = await cookies();
  jar.set(CALENDAR_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 600,
  });

  const url = calendarOAuthAuthUrl({
    clientId,
    redirectUri,
    state,
  });
  return NextResponse.json({ url, note: CALENDAR_VERIFICATION_NOTE });
}
