import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { AgencyRow, ProfileRow } from '@/types/database';

export interface ServerUser {
  user: { id: string; email: string } | null;
  profile: ProfileRow | null;
  agency: AgencyRow | null;
}

export async function getServerUser(): Promise<ServerUser> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, profile: null, agency: null };

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  if (!profile) {
    return { user: { id: user.id, email: user.email ?? '' }, profile: null, agency: null };
  }

  const { data: agency } = await supabase
    .from('agencies')
    .select('*')
    .eq('id', profile.agency_id)
    .single();

  return {
    user: { id: user.id, email: user.email ?? '' },
    profile,
    agency: agency ?? null,
  };
}
