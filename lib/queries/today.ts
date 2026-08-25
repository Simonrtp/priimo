import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, TodayDismissalRow } from '@/types/database';

type Client = SupabaseClient<Database>;

/**
 * Les cartes reportées ou ignorées par cet agent.
 * Clé de carte → date de réapparition, ou null si écartée définitivement.
 *
 * Tolère l'absence de la table avant application de la migration.
 */
export async function fetchTodayDismissals(
  supabase: Client,
  profileId: string,
): Promise<Map<string, string | null>> {
  try {
    const { data, error } = await supabase
      .from('today_dismissals')
      .select('card_key, snoozed_until')
      .eq('profile_id', profileId);

    if (error) throw new Error(error.message);

    const rows = (data ?? []) as unknown as Pick<TodayDismissalRow, 'card_key' | 'snoozed_until'>[];
    return new Map(rows.map((r) => [r.card_key, r.snoozed_until]));
  } catch (err) {
    console.error('[today] lecture des cartes écartées impossible', err);
    return new Map();
  }
}
