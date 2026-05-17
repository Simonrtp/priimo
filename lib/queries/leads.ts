import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, LeadRow, LeadSignalJson, ProfileRow } from '@/types/database';
import type { Lead, LeadSignal, MlFeedback, SignalType, TeamMember } from '@/types/lead';

type Client = SupabaseClient<Database>;

const KNOWN_SIGNAL_TYPES: ReadonlySet<string> = new Set<SignalType>([
  'dissolution_sci',
  'liquidation',
  'cession_parts',
  'changement_gerant',
  'deces_associe',
  'dpe_recent',
  'dpe_passoire',
  'detention_longue',
  'plus_value',
  'travaux_recents',
  'zone_rotation',
]);

function normalizeSignals(raw: unknown): LeadSignal[] {
  if (!Array.isArray(raw)) return [];
  const out: LeadSignal[] = [];
  for (const item of raw as LeadSignalJson[]) {
    if (!item || typeof item !== 'object') continue;
    const type = item.type;
    if (typeof type !== 'string' || !KNOWN_SIGNAL_TYPES.has(type)) continue;
    out.push({
      type: type as SignalType,
      label: typeof item.label === 'string' ? item.label : '',
      pts: typeof item.pts === 'number' ? item.pts : 0,
      source: typeof item.source === 'string' ? item.source : 'Source Priimo',
    });
  }
  return out;
}

export function mapDbLeadToLead(row: LeadRow): Lead {
  return {
    id: row.id,
    agencyId: row.agency_id,
    address: row.address,
    city: row.city,
    postalCode: row.postal_code,
    propertyType: row.property_type,
    surfaceM2: row.surface_m2,
    ownerType: row.owner_type,
    companyName: row.company_name,
    companyDirector: row.company_director,
    companyPhone: row.company_phone,
    companyEmail: row.company_email,
    score: row.score,
    signals: normalizeSignals(row.signals),
    acquiredYear: row.acquired_year,
    acquiredPrice: row.acquired_price,
    estimatedValue: row.estimated_value,
    dpeClass: row.dpe_class,
    dpeDate: row.dpe_date,
    status: row.status,
    notes: row.notes,
    assignedTo: row.assigned_to,
    mlFeedback: row.ml_feedback ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchLeads(supabase: Client): Promise<Lead[]> {
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .order('score', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) {
    throw new Error(`Impossible de charger les prospects : ${error.message}`);
  }
  return (data ?? []).map(mapDbLeadToLead);
}

function buildInitials(firstName: string, lastName: string): string {
  const a = firstName.trim().charAt(0).toUpperCase();
  const b = lastName.trim().charAt(0).toUpperCase();
  return `${a}${b}` || '?';
}

export function mapProfileToTeamMember(p: ProfileRow): TeamMember {
  return {
    id: p.id,
    firstName: p.first_name,
    lastName: p.last_name,
    fullName: `${p.first_name} ${p.last_name}`.trim(),
    initials: buildInitials(p.first_name, p.last_name),
  };
}

export async function fetchTeamMembers(supabase: Client, agencyId: string): Promise<TeamMember[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('agency_id', agencyId)
    .order('first_name', { ascending: true });
  if (error) {
    throw new Error(`Impossible de charger l'équipe : ${error.message}`);
  }
  return (data ?? []).map(mapProfileToTeamMember);
}

export interface LeadPatch {
  status?: Lead['status'];
  notes?: string | null;
  assignedTo?: string | null;
  mlFeedback?: MlFeedback;
}

export async function updateLead(supabase: Client, id: string, patch: LeadPatch): Promise<void> {
  const dbPatch: Partial<LeadRow> = {};
  if (patch.status !== undefined) dbPatch.status = patch.status;
  if (patch.notes !== undefined) dbPatch.notes = patch.notes;
  if (patch.assignedTo !== undefined) dbPatch.assigned_to = patch.assignedTo;
  if (patch.mlFeedback !== undefined) dbPatch.ml_feedback = patch.mlFeedback;
  const { error } = await supabase.from('leads').update(dbPatch).eq('id', id);
  if (error) {
    throw new Error(`Impossible de mettre à jour le prospect : ${error.message}`);
  }
}
