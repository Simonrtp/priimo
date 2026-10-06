import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, EstimationEventKindDb } from '@/types/database';

/** Journal pour le futur indicateur « estimations » du pilotage. */
export async function enregistrerEstimationEvent(
  session: SupabaseClient<Database>,
  input: {
    agencyId: string;
    estimationId: string;
    profileId: string | null;
    kind: EstimationEventKindDb;
  },
): Promise<void> {
  const { error } = await session.from('estimation_events').insert({
    agency_id: input.agencyId,
    estimation_id: input.estimationId,
    profile_id: input.profileId,
    kind: input.kind,
  });
  if (error && !/estimation_events|schema cache|does not exist/i.test(error.message)) {
    console.error('[estimation_events]', error.message);
  }
}
