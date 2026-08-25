import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { IntentType } from './intent';

/** Journalise la question, jamais la réponse. Échec silencieux si la table n'existe pas encore. */
export async function journaliserRequete(
  supabase: SupabaseClient<Database>,
  row: {
    agencyId: string;
    profileId: string;
    question: string;
    type: IntentType;
    lignesCount: number;
    durationMs: number;
  },
): Promise<void> {
  const { error } = await supabase.from('assistant_queries').insert({
    agency_id: row.agencyId,
    profile_id: row.profileId,
    question: row.question.slice(0, 2000),
    detected_type: row.type,
    lignes_count: row.lignesCount,
    duration_ms: Math.max(0, Math.round(row.durationMs)),
  });
  if (error) {
    console.error('[assistant] journal', error.message);
  }
}
