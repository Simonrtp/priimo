import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, QrSessionTerrainRow } from '@/types/database';
import { absoluteUrl } from '@/lib/site-url';
import {
  QR_PATH_PREFIX,
  QR_SESSION_PLAFOND,
  QR_SESSION_TTL_MS,
  hashQrToken,
  newQrToken,
} from '@/lib/qr/token';

type Admin = SupabaseClient<Database>;

const QR_SESSION_COLS_CORE =
  'id, agency_id, agent_id, token_sha256, ouverte_le, expire_le, revoquee_le, plafond, contacts_crees, dernier_usage_le, created_at, updated_at';
const QR_SESSION_COLS = `${QR_SESSION_COLS_CORE}, dernier_scan_prenom, dernier_scan_nom, dernier_scan_le`;

export type QrSessionPublic = {
  id: string;
  expireLe: string;
  plafond: number;
  contactsCrees: number;
  vivant: boolean;
  dernierScan: { prenom: string; nom: string; le: string } | null;
};

function tableMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const msg = error.message ?? '';
  return error.code === '42P01' || error.code === 'PGRST205' || /qr_sessions_terrain/i.test(msg);
}

export function sessionEstVivante(row: QrSessionTerrainRow, now = new Date()): boolean {
  if (row.revoquee_le) return false;
  const exp = Date.parse(row.expire_le);
  if (!Number.isFinite(exp) || exp <= now.getTime()) return false;
  return row.contacts_crees < row.plafond;
}

export function toQrSessionPublic(row: QrSessionTerrainRow, now = new Date()): QrSessionPublic {
  const prenom = row.dernier_scan_prenom?.trim() ?? '';
  const nom = row.dernier_scan_nom?.trim() ?? '';
  const le = row.dernier_scan_le ?? null;
  return {
    id: row.id,
    expireLe: row.expire_le,
    plafond: row.plafond,
    contactsCrees: row.contacts_crees,
    vivant: sessionEstVivante(row, now),
    dernierScan: le && (prenom || nom) ? { prenom, nom, le } : null,
  };
}

export async function openQrSession(
  admin: Admin,
  args: { agencyId: string; agentId: string; now?: Date },
): Promise<{ token: string; url: string; session: QrSessionPublic } | { missing: true } | { error: string }> {
  const now = args.now ?? new Date();
  const token = newQrToken();
  const expire = new Date(now.getTime() + QR_SESSION_TTL_MS);

  const previous = await admin
    .from('qr_sessions_terrain')
    .select('id')
    .eq('agent_id', args.agentId)
    .is('revoquee_le', null)
    .gt('expire_le', now.toISOString());
  if (previous.error && tableMissing(previous.error)) return { missing: true };
  if (previous.data && previous.data.length > 0) {
    await admin
      .from('qr_sessions_terrain')
      .update({ revoquee_le: now.toISOString() })
      .in('id', previous.data.map((r) => r.id));
  }

  const inserted = await admin
    .from('qr_sessions_terrain')
    .insert({
      agency_id: args.agencyId,
      agent_id: args.agentId,
      token_sha256: hashQrToken(token),
      ouverte_le: now.toISOString(),
      expire_le: expire.toISOString(),
      plafond: QR_SESSION_PLAFOND,
      contacts_crees: 0,
    })
    .select(QR_SESSION_COLS)
    .single();

  if (inserted.error) {
    if (tableMissing(inserted.error)) return { missing: true };
    return { error: inserted.error.message };
  }
  return {
    token,
    url: absoluteUrl(`${QR_PATH_PREFIX}${token}`),
    session: toQrSessionPublic(inserted.data, now),
  };
}

export async function fetchQrSessionForAgent(
  admin: Admin,
  args: { agencyId: string; agentId: string; sessionId: string },
): Promise<QrSessionTerrainRow | null | { missing: true }> {
  const res = await admin
    .from('qr_sessions_terrain')
    .select(QR_SESSION_COLS)
    .eq('id', args.sessionId)
    .eq('agency_id', args.agencyId)
    .maybeSingle();
  if (res.error && tableMissing(res.error)) return { missing: true };
  if (!res.data || res.data.agent_id !== args.agentId) return null;
  return res.data;
}

export async function revokeQrSession(
  admin: Admin,
  args: { agencyId: string; agentId: string; sessionId: string; now?: Date },
): Promise<{ ok: true } | { missing: true } | { error: string }> {
  const now = args.now ?? new Date();
  const res = await admin
    .from('qr_sessions_terrain')
    .update({ revoquee_le: now.toISOString() })
    .eq('id', args.sessionId)
    .eq('agency_id', args.agencyId)
    .eq('agent_id', args.agentId)
    .is('revoquee_le', null);
  if (res.error) {
    if (tableMissing(res.error)) return { missing: true };
    return { error: res.error.message };
  }
  return { ok: true };
}

export async function lookupLiveQrSession(
  admin: Admin,
  token: string,
  now = new Date(),
): Promise<QrSessionTerrainRow | null | { missing: true }> {
  const res = await admin
    .from('qr_sessions_terrain')
    .select(QR_SESSION_COLS)
    .eq('token_sha256', hashQrToken(token))
    .maybeSingle();
  if (res.error && tableMissing(res.error)) return { missing: true };
  if (!res.data || !sessionEstVivante(res.data, now)) return null;
  return res.data;
}

export async function consumeQrSessionSlot(
  admin: Admin,
  row: QrSessionTerrainRow,
  now = new Date(),
): Promise<boolean> {
  let current = row;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (!sessionEstVivante(current, now)) return false;
    const res = await admin
      .from('qr_sessions_terrain')
      .update({
        contacts_crees: current.contacts_crees + 1,
        dernier_usage_le: now.toISOString(),
      })
      .eq('id', current.id)
      .eq('contacts_crees', current.contacts_crees)
      .is('revoquee_le', null)
      .gt('expire_le', now.toISOString())
      .select('id')
      .maybeSingle();
    if (res.data?.id) return true;

    const fresh = await admin
      .from('qr_sessions_terrain')
      .select(QR_SESSION_COLS)
      .eq('id', row.id)
      .maybeSingle();
    if (!fresh.data) return false;
    current = fresh.data;
  }
  return false;
}
