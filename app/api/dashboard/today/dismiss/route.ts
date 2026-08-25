import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/**
 * Reporter ou ignorer une carte de l'écran Aujourd'hui.
 * `snoozedUntil` null = ignorée définitivement.
 */
export async function POST(req: Request) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  let body: { cardKey?: unknown; snoozedUntil?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }

  const cardKey = typeof body.cardKey === 'string' ? body.cardKey.trim() : '';
  if (!cardKey || cardKey.length > 200) {
    return NextResponse.json({ error: 'Carte inconnue' }, { status: 400 });
  }

  let snoozedUntil: string | null = null;
  if (typeof body.snoozedUntil === 'string') {
    const t = Date.parse(body.snoozedUntil);
    if (Number.isNaN(t)) {
      return NextResponse.json({ error: 'Date de report invalide' }, { status: 400 });
    }
    snoozedUntil = new Date(t).toISOString();
  } else if (body.snoozedUntil !== null && body.snoozedUntil !== undefined) {
    return NextResponse.json({ error: 'Date de report invalide' }, { status: 400 });
  }

  // RLS impose profile_id = auth.uid() et l'agence active : pas de client admin ici.
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from('today_dismissals').upsert(
    {
      agency_id: agency.id,
      profile_id: profile.id,
      card_key: cardKey,
      snoozed_until: snoozedUntil,
    },
    { onConflict: 'profile_id,card_key' },
  );

  if (error) {
    console.error('[today/dismiss]', error);
    return NextResponse.json({ error: 'Enregistrement impossible' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
