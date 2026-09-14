import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getServerUser } from '@/lib/auth/getServerUser';
import {
  CALENDAR_OAUTH_SCOPES,
  CALENDAR_OAUTH_STATE_COOKIE,
  calendarOAuthRedirectUri,
  encryptCalendarTokens,
  fetchCalendarPrimary,
  oauthPublicOrigin,
} from '@/lib/agenda/google-calendar';
import { exchangeCodeForTokens } from '@/lib/inbound/gmail';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

function redirectAfter(req: Request, next: string, query: string) {
  const origin = oauthPublicOrigin(req);
  if (next === 'settings') {
    return NextResponse.redirect(`${origin}/dashboard/settings?tab=integrations&${query}`);
  }
  return NextResponse.redirect(`${origin}/dashboard?${query}`);
}

export async function GET(req: Request) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return redirectAfter(req, 'dashboard', 'agenda=auth_required');
  }

  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const stateParam = url.searchParams.get('state');
  const oauthError = url.searchParams.get('error');

  const jar = await cookies();
  const expectedState = jar.get(CALENDAR_OAUTH_STATE_COOKIE)?.value;
  jar.delete(CALENDAR_OAUTH_STATE_COOKIE);

  let next = 'dashboard';
  try {
    if (stateParam) {
      const parsed = JSON.parse(Buffer.from(stateParam, 'base64url').toString('utf8')) as {
        next?: string;
      };
      if (parsed.next === 'settings') next = 'settings';
    }
  } catch {
    /* state lu plus bas */
  }

  if (oauthError) return redirectAfter(req, next, 'agenda=denied');
  if (!code || !stateParam || !expectedState || stateParam !== expectedState) {
    return redirectAfter(req, next, 'agenda=invalid_state');
  }

  let state: { agencyId: string; profileId: string };
  try {
    state = JSON.parse(Buffer.from(stateParam, 'base64url').toString('utf8')) as {
      agencyId: string;
      profileId: string;
    };
  } catch {
    return redirectAfter(req, next, 'agenda=invalid_state');
  }

  if (state.agencyId !== agency.id || state.profileId !== profile.id) {
    return redirectAfter(req, next, 'agenda=agency_mismatch');
  }

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  const redirectUri = calendarOAuthRedirectUri(req);
  if (!clientId || !clientSecret || !redirectUri) {
    return redirectAfter(req, next, 'agenda=not_configured');
  }

  const admin = createSupabaseAdminClient();

  try {
    const tokens = await exchangeCodeForTokens({
      code,
      clientId,
      clientSecret,
      redirectUri,
    });
    const primary = await fetchCalendarPrimary(tokens.access_token);
    const { ciphertext, nonce } = encryptCalendarTokens({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : null,
    });

    const { error } = await admin.from('calendar_connexions').upsert(
      {
        agency_id: agency.id,
        profile_id: profile.id,
        calendar_email: primary.id,
        token_ciphertext: `\\x${ciphertext.toString('hex')}`,
        token_nonce: `\\x${nonce.toString('hex')}`,
        scopes: [...CALENDAR_OAUTH_SCOPES],
        etat: 'actif',
        dernier_erreur: null,
        connected_at: new Date().toISOString(),
      },
      { onConflict: 'agency_id,profile_id' },
    );

    if (error) throw new Error(error.message);

    return redirectAfter(req, next, 'agenda=connected');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'oauth_failed';
    console.error('[calendar oauth]', message);
    let flag = 'agenda=error';
    if (/invalid_client|client secret is invalid/i.test(message)) {
      flag = 'agenda=bad_secret';
    } else if (/redirect_uri_mismatch/i.test(message)) {
      flag = 'agenda=token';
    } else if (/Calendar primary failed|accessNotConfigured|has not been used|Google Calendar API/i.test(message)) {
      flag = 'agenda=no_api';
    } else if (/GMAIL_TOKEN_ENCRYPTION_KEY/i.test(message)) {
      flag = 'agenda=crypto';
    } else if (/calendar_connexions/i.test(message)) {
      flag = 'agenda=missing_table';
    }
    return redirectAfter(req, next, flag);
  }
}
