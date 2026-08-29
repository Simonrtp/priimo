import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

/**
 * Anniversaires du jour — membres ayant consenti à l’affichage équipe.
 */

export type AnniversaireDuJour = {
  profileId: string;
  firstName: string;
};

export async function fetchAnniversairesDuJour(
  supabase: SupabaseClient<Database>,
  agencyId: string,
  now = new Date(),
): Promise<AnniversaireDuJour[]> {
  const month = now.getMonth() + 1;
  const day = now.getDate();

  const { data: memberships } = await supabase
    .from('profile_agencies')
    .select('profile_id')
    .eq('agency_id', agencyId);

  const ids = (memberships ?? []).map((m) => m.profile_id).filter(Boolean);
  if (ids.length === 0) return [];

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, first_name, birthday_month, birthday_day, birthday_visible_team')
    .in('id', ids)
    .eq('birthday_month', month)
    .eq('birthday_day', day)
    .eq('birthday_visible_team', true);

  return (profiles ?? []).map((p) => ({
    profileId: p.id,
    firstName: (p.first_name ?? '').trim() || 'un collègue',
  }));
}
