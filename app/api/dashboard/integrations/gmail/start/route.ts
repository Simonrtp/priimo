import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getServerUser } from '@/lib/auth/getServerUser';
import {
  GMAIL_OAUTH_STATE_COOKIE,
  GMAIL_VERIFICATION_NOTE,
  gmailOAuthAuthUrl,
} from '@/lib/inbound/gmail';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

/**
 * Démarre OAuth Gmail (gmail.readonly) pour l'utilisateur courant.
 * Scope restreint Google — voir GMAIL_VERIFICATION_NOTE.
 */
export async function GET() {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim();
  if (!clientId || !redirectUri) {
    return NextResponse.json(
      {
        error: 'OAuth Google non configuré (GOOGLE_OAUTH_CLIENT_ID / REDIRECT_URI)',
        note: GMAIL_VERIFICATION_NOTE,
      },
      { status: 503 },
    );
  }

  const nonce = crypto.randomUUID();
  const state = Buffer.from(
    JSON.stringify({ agencyId: agency.id, profileId: profile.id, nonce }),
  ).toString('base64url');

  const jar = await cookies();
  jar.set(GMAIL_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 600,
  });

  const admin = createSupabaseAdminClient();
  await admin.from('diffusion_evenements').insert({
    agency_id: agency.id,
    sens: 'systeme',
    kind: 'gmail_oauth_start',
    message: 'Démarrage OAuth Gmail',
    payload: { profile_id: profile.id },
  });

  const url = gmailOAuthAuthUrl({ clientId, redirectUri, state });
  return NextResponse.json({ url, note: GMAIL_VERIFICATION_NOTE });
}
