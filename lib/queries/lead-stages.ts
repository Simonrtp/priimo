import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, LeadStageRow, LeadStageTypeDb } from '@/types/database';
import type { LeadStage, LeadStageType } from '@/types/lead';

type Client = SupabaseClient<Database>;

const STAGE_TYPES: readonly LeadStageTypeDb[] = ['entree', 'intermediaire', 'gagne', 'perdu'];

function asStageType(raw: string): LeadStageType {
  return (STAGE_TYPES as readonly string[]).includes(raw) ? (raw as LeadStageType) : 'intermediaire';
}

function defaultAccentColor(cle: string, type: LeadStageType): string {
  if (cle === 'pris') return '#64748B';
  if (cle === 'contacte') return '#E8743C';
  if (cle === 'rendez_vous') return '#2E8B57';
  if (cle === 'mandat') return '#2E8B57';
  if (cle === 'perdu') return '#D16B5B';
  if (type === 'gagne') return '#2E8B57';
  if (type === 'perdu') return '#D16B5B';
  return '#4A90E2';
}

export function mapLeadStage(row: LeadStageRow): LeadStage {
  const type = asStageType(row.type);
  return {
    id: row.id,
    agencyId: row.agency_id,
    cle: row.cle,
    libelle: row.libelle,
    ordre: row.ordre,
    accentColor: row.accent_color ?? defaultAccentColor(row.cle, type),
    type,
  };
}

/** Étapes de l'agence, triées par `ordre`. Table absente → tableau vide. */
export async function fetchLeadStages(supabase: Client): Promise<LeadStage[]> {
  const withColor = await supabase
    .from('lead_stages')
    .select('id, agency_id, cle, libelle, ordre, accent_color, type, created_at')
    .order('ordre', { ascending: true });

  if (!withColor.error) {
    return (withColor.data ?? []).map((row) => mapLeadStage(row as LeadStageRow));
  }

  const fallback = await supabase
    .from('lead_stages')
    .select('id, agency_id, cle, libelle, ordre, type, created_at')
    .order('ordre', { ascending: true });

  if (fallback.error) {
    console.error('[lead_stages] lecture', fallback.error.message);
    return [];
  }

  return (fallback.data ?? []).map((row) =>
    mapLeadStage({
      ...(row as Omit<LeadStageRow, 'accent_color'>),
      accent_color: defaultAccentColor(row.cle, asStageType(row.type)),
    }),
  );
}

export function entreeStage(stages: readonly LeadStage[]): LeadStage | null {
  return stages.find((s) => s.type === 'entree') ?? null;
}
