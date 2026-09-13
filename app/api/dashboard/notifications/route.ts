import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  fetchNotifications,
  marquerNotificationLue,
  marquerToutesLues,
} from '@/lib/queries/notifications';

export const runtime = 'nodejs';

export async function GET() {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const supabase = await createSupabaseServerClient();
  const notifications = await fetchNotifications(supabase, {
    profileId: profile.id,
    agencyId: agency.id,
  });
  return NextResponse.json({ notifications });
}

export async function PATCH(req: Request) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }
  const raw = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
  const supabase = await createSupabaseServerClient();
  const scope = { profileId: profile.id, agencyId: agency.id };

  if (raw.tous === true) {
    const ok = await marquerToutesLues(supabase, scope);
    if (!ok) return NextResponse.json({ error: 'Marquage impossible' }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (typeof raw.id !== 'string' || !raw.id) {
    return NextResponse.json({ error: 'Notification inconnue' }, { status: 400 });
  }

  const ids = Array.isArray(raw.ids)
    ? raw.ids.filter((id): id is string => typeof id === 'string' && id.length > 0)
    : [raw.id];

  for (const id of ids) {
    const ok = await marquerNotificationLue(supabase, { ...scope, id });
    if (!ok) return NextResponse.json({ error: 'Marquage impossible' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
