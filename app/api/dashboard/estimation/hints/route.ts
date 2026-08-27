import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { peekBuildingHints } from '@/lib/estimation/dvf-engine';

export const runtime = 'nodejs';

/** Aperçu discret dès résolution BAN : ventes connues + copro + DPE. */
export async function GET(req: Request) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const banId = new URL(req.url).searchParams.get('banId')?.trim();
  if (!banId) {
    return NextResponse.json({ error: 'banId requis' }, { status: 400 });
  }

  const hints = await peekBuildingHints(createSupabaseAdminClient(), banId);
  return NextResponse.json(hints);
}
