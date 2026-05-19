import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, LeadRow, ProfileRow } from '@/types/database';
import type { Lead, LeadSignal, MlFeedback, TeamMember } from '@/types/lead';

type Client = SupabaseClient<Database>;

type RawSignalItem = {
  type?: unknown;
  label?: unknown;
  pts?: unknown;
  points?: unknown;
  source?: unknown;
};

function parseSignalItem(item: RawSignalItem): LeadSignal | null {
  if (!item || typeof item !== 'object') return null;
  const type = typeof item.type === 'string' ? item.type : 'signal';
  const label = typeof item.label === 'string' ? item.label : '';
  const pts =
    typeof item.points === 'number'
      ? item.points
      : typeof item.pts === 'number'
        ? item.pts
        : 0;
  const source = typeof item.source === 'string' ? item.source : 'Source Priimo';
  return { type, label, pts, source };
}

/** Accepte un tableau legacy ou `{ details: [...], main_signal_label }`. */
export function normalizeSignals(raw: unknown): {
  signals: LeadSignal[];
  mainSignalLabel: string | null;
} {
  let items: RawSignalItem[] = [];
  let mainSignalLabel: string | null = null;

  if (Array.isArray(raw)) {
    items = raw as RawSignalItem[];
  } else if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if (typeof obj.main_signal_label === 'string') {
      mainSignalLabel = obj.main_signal_label;
    }
    if (Array.isArray(obj.details)) {
      items = obj.details as RawSignalItem[];
    }
  }

  const signals: LeadSignal[] = [];
  for (const item of items) {
    const parsed = parseSignalItem(item);
    if (parsed) signals.push(parsed);
  }

  return { signals, mainSignalLabel };
}

export function mapDbLeadToLead(row: LeadRow): Lead {
  const { signals, mainSignalLabel } = normalizeSignals(row.signals);
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
    signals,
    mainSignalLabel,
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
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

export async function deleteLead(supabase: Client, id: string): Promise<void> {
  const { error } = await supabase.from('leads').delete().eq('id', id);
  if (error) {
    throw new Error(`Impossible de supprimer le prospect : ${error.message}`);
  }
}
