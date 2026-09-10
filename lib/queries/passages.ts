import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { LeadStage } from '@/types/lead';
import { semaineDe, fenetreSemaines } from '@/lib/activite/semaines';
import { fetchJournalActivite } from '@/lib/queries/activite';
import { passagesDepuisJournal } from '@/lib/zones/passages';
import type { PassageObserve } from '@/lib/zones/fraicheur';

type Client = SupabaseClient<Database>;

/**
 * Passages observés sur ~trois mois. Sert au cycle médian et à la fraîcheur,
 * jamais à une saisie déclarative.
 */
export async function fetchPassagesObserves(params: {
  supabase: Client;
  stages: readonly LeadStage[];
  maintenant?: Date;
}): Promise<PassageObserve[]> {
  const intervalle = fenetreSemaines(semaineDe(params.maintenant ?? new Date()), 13);
  try {
    const journal = await fetchJournalActivite({
      supabase: params.supabase,
      intervalle,
      stages: params.stages,
    });
    return passagesDepuisJournal(journal);
  } catch (err) {
    console.error('[passages] journal illisible', err);
    return [];
  }
}
