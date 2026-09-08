import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { asEncryptedBuffer, decryptTokenPayload, revokeGoogleToken } from '@/lib/inbound/gmail';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

export async function POST() {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const { data: row } = await admin
    .from('calendar_connexions')
    .select('id, token_ciphertext, token_nonce')
    .eq('agency_id', agency.id)
    .eq('profile_id', profile.id)
    .maybeSingle();

  if (!row) {
    return NextResponse.json({ ok: true, already: true });
  }

  try {
    const cipher = asEncryptedBuffer(row.token_ciphertext);
    const nonce = asEncryptedBuffer(row.token_nonce);
    if (cipher.length > 0 && nonce.length > 0) {
      const tokens = decryptTokenPayload<{
        access_token?: string;
        refresh_token?: string;
      }>(cipher, nonce);
      const toRevoke = tokens.refresh_token || tokens.access_token;
      if (toRevoke) await revokeGoogleToken(toRevoke);
    }
  } catch {
    /* purge locale même si Google est injoignable */
  }

  await admin.from('calendar_connexions').delete().eq('id', row.id);
  return NextResponse.json({ ok: true });
}
