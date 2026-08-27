import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { dateKeyParis } from '@/lib/today/calendar';
import type { SortieEventKindDb, SortieEventInsert } from '@/types/database';

export const runtime = 'nodejs';

const KINDS = new Set<string>([
  'start',
  'pause',
  'resume',
  'finish',
  'rencontre',
  'absent',
  'passer',
  'remove_stop',
  'recalc_origin',
  'dictee',
]);

export async function POST(req: Request) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }
  if (profile.role === 'directeur') {
    return NextResponse.json({ error: 'Réservé aux collaborateurs' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }

  const row = body as {
    kind?: string;
    leadId?: string | null;
    stopKey?: string | null;
    payload?: Record<string, unknown>;
    clientId?: string | null;
    day?: string | null;
  };

  const kindRaw = typeof row.kind === 'string' ? row.kind : '';
  if (!KINDS.has(kindRaw)) {
    return NextResponse.json({ error: 'Type d’événement invalide' }, { status: 400 });
  }
  const kind = kindRaw as SortieEventKindDb;

  const day =
    typeof row.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(row.day)
      ? row.day
      : dateKeyParis(new Date());

  const supabase = await createSupabaseServerClient();
  const insert: SortieEventInsert = {
    agency_id: agency.id,
    profile_id: profile.id,
    day,
    kind,
    lead_id: typeof row.leadId === 'string' ? row.leadId : null,
    stop_key: typeof row.stopKey === 'string' ? row.stopKey : null,
    payload: row.payload && typeof row.payload === 'object' ? row.payload : {},
    client_id: typeof row.clientId === 'string' ? row.clientId : null,
  };

  const { data, error } = await supabase
    .from('sortie_events')
    .insert(insert)
    .select('id')
    .maybeSingle();

  if (error) {
    // Idempotence client_id
    if (error.code === '23505' && insert.client_id) {
      return NextResponse.json({ ok: true, duplicate: true }, { status: 409 });
    }
    console.error('[sortie_events]', error.message);
    return NextResponse.json({ error: 'Enregistrement impossible' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: data?.id ?? null });
}
