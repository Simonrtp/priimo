import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { listerActionsOuvertes } from '@/lib/queries/actions';
import { isAutomationKind, type AutomationKind } from '@/lib/automations/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const url = new URL(req.url);
  const kinds = url.searchParams
    .getAll('kind')
    .filter((k): k is AutomationKind => isAutomationKind(k));

  const supabase = await createSupabaseServerClient();
  const actions = await listerActionsOuvertes(supabase, agency.id, {
    profileId: profile.id,
    estDirecteur: profile.role === 'directeur',
    kinds: kinds.length > 0 ? kinds : undefined,
  });

  return NextResponse.json({ actions });
}
