import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { decryptTokenPayload, revokeGoogleToken } from '@/lib/inbound/gmail';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

function asBuffer(value: unknown): Buffer {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (typeof value === 'string') {
    const hex = value.startsWith('\\x') ? value.slice(2) : value;
    if (hex.length === 0) return Buffer.alloc(0);
    if (/^[0-9a-fA-F]+$/.test(hex) && hex.length % 2 === 0) {
      return Buffer.from(hex, 'hex');
    }
    return Buffer.from(value, 'base64');
  }
  return Buffer.alloc(0);
}

/**
 * Déconnecte Gmail : révoque le jeton chez Google, puis supprime la ligne chez nous.
 */
export async function POST() {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const { data: row } = await admin
    .from('gmail_connexions')
    .select('id, token_ciphertext, token_nonce')
    .eq('agency_id', agency.id)
    .eq('profile_id', profile.id)
    .maybeSingle();

  if (!row) {
    return NextResponse.json({ ok: true, already: true });
  }

  try {
    const cipher = asBuffer(row.token_ciphertext);
    const nonce = asBuffer(row.token_nonce);
    if (cipher.length > 0 && nonce.length > 0) {
      const tokens = decryptTokenPayload<{
        access_token?: string;
        refresh_token?: string;
      }>(cipher, nonce);
      const toRevoke = tokens.refresh_token || tokens.access_token;
      if (toRevoke) await revokeGoogleToken(toRevoke);
    }
  } catch {
    // On continue la purge locale même si Google est injoignable.
  }

  await admin.from('gmail_connexions').delete().eq('id', row.id);

  await admin.from('diffusion_evenements').insert({
    agency_id: agency.id,
    sens: 'systeme',
    kind: 'gmail_oauth_revoke',
    message: 'Gmail déconnecté (révocation Google)',
    payload: { profile_id: profile.id },
  });

  return NextResponse.json({ ok: true });
}
