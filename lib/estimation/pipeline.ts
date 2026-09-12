import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { poussePipelineEstimation, type EstimationEtat } from '@/lib/estimation/cycle';

type Db = SupabaseClient<Database>;

/**
 * L'état realisee alimente le pipeline existant. Il ne le duplique pas.
 */
export async function syncLeadEtapeEstimation(params: {
  supabase: Db;
  agencyId: string;
  leadId: string | null;
  etat: EstimationEtat;
}): Promise<void> {
  if (!params.leadId || !poussePipelineEstimation(params.etat)) return;

  const { data: stage } = await params.supabase
    .from('lead_stages')
    .select('id')
    .eq('agency_id', params.agencyId)
    .eq('cle', 'estimation')
    .maybeSingle();
  if (!stage) return;

  await params.supabase
    .from('leads')
    .update({ stage_id: stage.id })
    .eq('id', params.leadId)
    .eq('agency_id', params.agencyId);
}
