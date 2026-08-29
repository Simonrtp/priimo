import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

function joursDansMois(mois: number): number {
  return [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mois - 1] ?? 31;
}

/** Enregistre jour + mois d’anniversaire (+ consentement équipe). */
export async function POST(req: Request) {
  const { user, profile } = await getServerUser();
  if (!user || !profile) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  let raw: Record<string, unknown>;
  try {
    raw = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }

  const month = Number(raw.month);
  const day = Number(raw.day);
  const visibleTeam = Boolean(raw.visibleTeam);

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: 'Mois invalide' }, { status: 400 });
  }
  if (!Number.isInteger(day) || day < 1 || day > joursDansMois(month)) {
    return NextResponse.json({ error: 'Jour invalide' }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('profiles')
    .update({
      birthday_month: month,
      birthday_day: day,
      birthday_visible_team: visibleTeam,
    })
    .eq('id', profile.id);

  if (error) {
    console.error('[profile/birthday]', error);
    return NextResponse.json({ error: 'Enregistrement impossible' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

/** Efface la date (paramètres). */
export async function DELETE() {
  const { user, profile } = await getServerUser();
  if (!user || !profile) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('profiles')
    .update({
      birthday_month: null,
      birthday_day: null,
      birthday_visible_team: false,
    })
    .eq('id', profile.id);

  if (error) {
    return NextResponse.json({ error: 'Suppression impossible' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
