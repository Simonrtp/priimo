import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { viewerFromProfile } from '@/lib/agency/visibility';
import { buildSuggestions, fetchSearchRows, SEARCH_MIN_LEN } from '@/lib/assistant/search';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const q = new URL(req.url).searchParams.get('q')?.trim() ?? '';
  if (q.length < SEARCH_MIN_LEN) {
    return NextResponse.json({ suggestions: [] });
  }

  const supabase = await createSupabaseServerClient();
  const viewer = viewerFromProfile(profile);
  const rows = await fetchSearchRows(supabase, agency.id, q);
  const suggestions = buildSuggestions(q, rows, viewer);

  return NextResponse.json({ suggestions });
}
