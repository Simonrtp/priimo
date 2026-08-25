import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, LeadStageRow, LeadStageTypeDb } from '@/types/database';
import type { LeadStage, LeadStageType } from '@/types/lead';

type Client = SupabaseClient<Database>;

const STAGE_TYPES: readonly LeadStageTypeDb[] = ['entree', 'intermediaire', 'gagne', 'perdu'];

function asStageType(raw: string): LeadStageType {
  return (STAGE_TYPES as readonly string[]).includes(raw) ? (raw as LeadStageType) : 'intermediaire';
}

export function mapLeadStage(row: LeadStageRow): LeadStage {
  return {
    id: row.id,
    agencyId: row.agency_id,
    cle: row.cle,
    libelle: row.libelle,
    ordre: row.ordre,
    type: asStageType(row.type),
  };
}

/** Étapes de l'agence, triées par `ordre`. Table absente → tableau vide. */
export async function fetchLeadStages(supabase: Client): Promise<LeadStage[]> {
  const { data, error } = await supabase
    .from('lead_stages')
    .select('id, agency_id, cle, libelle, ordre, type, created_at')
    .order('ordre', { ascending: true });

  if (error) {
    console.error('[lead_stages] lecture', error.message);
    return [];
  }
  return (data ?? []).map((row) => mapLeadStage(row as LeadStageRow));
}

export function entreeStage(stages: readonly LeadStage[]): LeadStage | null {
  return stages.find((s) => s.type === 'entree') ?? null;
}
