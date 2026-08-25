import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { viewerFromProfile } from '@/lib/agency/visibility';
import { buildSuggestions, ilikePattern } from '@/lib/assistant/suggestions';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const MIN_LEN = 2;
const ROW_LIMIT = 40;

export async function GET(req: Request) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const q = new URL(req.url).searchParams.get('q')?.trim() ?? '';
  if (q.length < MIN_LEN) {
    return NextResponse.json({ suggestions: [] });
  }

  const like = ilikePattern(q);
  const supabase = await createSupabaseServerClient();
  const viewer = viewerFromProfile(profile);

  const [leadsRes, contactsRes, biensRes] = await Promise.all([
    supabase
      .from('leads')
      .select('id, address, city, postal_code, adresse_normalisee, assigned_to')
      .eq('agency_id', agency.id)
      .or(`address.ilike."${like}",adresse_normalisee.ilike."${like}",postal_code.ilike."${like}"`)
      .order('created_at', { ascending: false })
      .limit(ROW_LIMIT),
    supabase
      .from('contacts')
      .select('id, first_name, last_name, address, contact_type, assigned_to, created_by')
      .eq('agency_id', agency.id)
      .or(`first_name.ilike."${like}",last_name.ilike."${like}",address.ilike."${like}"`)
      .order('created_at', { ascending: false })
      .limit(ROW_LIMIT),
    supabase
      .from('biens')
      .select('id, address, city, postal_code, created_by')
      .eq('agency_id', agency.id)
      .or(`address.ilike."${like}",postal_code.ilike."${like}"`)
      .order('created_at', { ascending: false })
      .limit(ROW_LIMIT),
  ]);

  const suggestions = buildSuggestions(
    q,
    {
      leads: leadsRes.data ?? [],
      contacts: contactsRes.data ?? [],
      biens: biensRes.data ?? [],
    },
    viewer,
  );

  return NextResponse.json({ suggestions });
}
