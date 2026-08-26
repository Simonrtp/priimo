import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getServerUser } from '@/lib/auth/getServerUser';
import {
  GMAIL_OAUTH_SCOPES,
  GMAIL_OAUTH_STATE_COOKIE,
  encryptTokenPayload,
  exchangeCodeForTokens,
  fetchGmailProfile,
  startGmailWatch,
} from '@/lib/inbound/gmail';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

function settingsRedirect(query: string) {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || '';
  return NextResponse.redirect(`${base}/dashboard/settings?tab=integrations&${query}`);
}

/**
 * Callback OAuth Gmail — stocke les jetons chiffrés, démarre le watch Pub/Sub.
 */
export async function GET(req: Request) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return settingsRedirect('gmail=auth_required');
  }

  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const stateParam = url.searchParams.get('state');
  const oauthError = url.searchParams.get('error');

  const jar = await cookies();
  const expectedState = jar.get(GMAIL_OAUTH_STATE_COOKIE)?.value;
  jar.delete(GMAIL_OAUTH_STATE_COOKIE);

  if (oauthError) {
    return settingsRedirect(`gmail=denied`);
  }
  if (!code || !stateParam || !expectedState || stateParam !== expectedState) {
    return settingsRedirect('gmail=invalid_state');
  }

  let state: { agencyId: string; profileId: string };
  try {
    state = JSON.parse(Buffer.from(stateParam, 'base64url').toString('utf8')) as {
      agencyId: string;
      profileId: string;
    };
  } catch {
    return settingsRedirect('gmail=invalid_state');
  }

  if (state.agencyId !== agency.id || state.profileId !== profile.id) {
    return settingsRedirect('gmail=agency_mismatch');
  }

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim();
  if (!clientId || !clientSecret || !redirectUri) {
    return settingsRedirect('gmail=not_configured');
  }

  const admin = createSupabaseAdminClient();

  try {
    const tokens = await exchangeCodeForTokens({
      code,
      clientId,
      clientSecret,
      redirectUri,
    });
    const profileGmail = await fetchGmailProfile(tokens.access_token);
    const { ciphertext, nonce } = encryptTokenPayload({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: tokens.expires_in
        ? Date.now() + tokens.expires_in * 1000
        : null,
    });

    const topic = process.env.GMAIL_PUBSUB_TOPIC?.trim() || null;
    let watchHistoryId: string | null = null;
    let watchExpiration: string | null = null;
    let etat: string = 'actif';
    let dernierErreur: string | null = null;

    if (topic) {
      try {
        const watch = await startGmailWatch({
          accessToken: tokens.access_token,
          topicName: topic,
        });
        watchHistoryId = watch.historyId;
        watchExpiration = new Date(Number(watch.expiration)).toISOString();
      } catch (err) {
        etat = 'erreur';
        dernierErreur = err instanceof Error ? err.message : 'watch failed';
      }
    }

    const { error } = await admin.from('gmail_connexions').upsert(
      {
        agency_id: agency.id,
        profile_id: profile.id,
        gmail_address: profileGmail.emailAddress,
        token_ciphertext: `\\x${ciphertext.toString('hex')}`,
        token_nonce: `\\x${nonce.toString('hex')}`,
        scopes: [...GMAIL_OAUTH_SCOPES],
        watch_history_id: watchHistoryId,
        watch_expiration: watchExpiration,
        pubsub_topic: topic,
        etat,
        dernier_erreur: dernierErreur,
        connected_at: new Date().toISOString(),
      },
      { onConflict: 'agency_id,profile_id' },
    );

    if (error) throw new Error(error.message);

    await admin.from('diffusion_evenements').insert({
      agency_id: agency.id,
      sens: 'systeme',
      kind: 'gmail_oauth_ok',
      message: `Gmail connecté (${profileGmail.emailAddress})`,
      payload: { profile_id: profile.id, watch: Boolean(watchHistoryId) },
    });

    return settingsRedirect(etat === 'actif' ? 'gmail=connected' : 'gmail=watch_error');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'oauth_failed';
    await admin.from('diffusion_evenements').insert({
      agency_id: agency.id,
      sens: 'systeme',
      kind: 'gmail_oauth_erreur',
      message: message.slice(0, 500),
      payload: { profile_id: profile.id },
    });
    return settingsRedirect('gmail=error');
  }
}
