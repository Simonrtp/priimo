import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, LeadRow, ProfileRow } from '@/types/database';
import type { Lead, LeadSignal, MlFeedback, TeamMember } from '@/types/lead';
import { parseDisplaySignals } from '@/lib/display-signals';

type Client = SupabaseClient<Database>;

type RawSignalItem = {
  type?: unknown;
  label?: unknown;
  pts?: unknown;
  points?: unknown;
  source?: unknown;
  category?: unknown;
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
  const category = typeof item.category === 'string' ? item.category : null;
  return { type, label, pts, source, category };
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
    displaySignals: parseDisplaySignals(row.display_signals),
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    acquiredYear: row.acquired_year,
    acquiredPrice: row.acquired_price,
    acquiredPriceReliable: row.acquired_price_reliable ?? null,
    estimatedValue: row.estimated_value,
    estimationLow: row.estimation_low ?? null,
    estimationHigh: row.estimation_high ?? null,
    estimationConfidence: row.estimation_confidence ?? null,
    estimationBasis: row.estimation_basis ?? null,
    plusValuePct: row.plus_value_pct != null ? Number(row.plus_value_pct) : null,
    rooms: row.rooms ?? null,
    floor: row.floor ?? null,
    dpeClass: row.dpe_class,
    dpeDate: row.dpe_date,
    status: row.status,
    notes: row.notes,
    assignedTo: row.assigned_to,
    mlFeedback: row.ml_feedback ?? null,
    mlFeedbackReason: row.ml_feedback_reason ?? null,
    mlFeedbackAt: row.ml_feedback_at ?? null,
    deliveredAt: row.delivered_at ?? row.created_at.slice(0, 10),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * On utilise `*` car certaines colonnes optionnelles (display_signals,
 * rooms, floor, …) ne sont créées qu'après application des migrations
 * — un SELECT explicite échouerait tant qu'elles n'existent pas.
 *
 * `internal_signals` (secret scoring) est filtré côté parser via
 * `stripInternalSignals` : même si la colonne est transmise sur le
 * réseau, plus aucun code applicatif n'y a accès. Pour une exclusion
 * réseau stricte, mettre en place une vue Postgres `leads_public`
 * (whitelist de colonnes) et y sélectionner ici.
 */
function stripInternalSignals<T extends object>(row: T): T {
  if ('internal_signals' in row) {
    const { internal_signals: _strip, ...rest } = row as T & { internal_signals?: unknown };
    return rest as T;
  }
  return row;
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
  return (data ?? []).map((row) => mapDbLeadToLead(stripInternalSignals(row)));
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
  mlFeedbackReason?: string | null;
  mlFeedbackAt?: string | null;
}

export async function updateLead(supabase: Client, id: string, patch: LeadPatch): Promise<void> {
  const dbPatch: Partial<LeadRow> = {};
  if (patch.status !== undefined) dbPatch.status = patch.status;
  if (patch.notes !== undefined) dbPatch.notes = patch.notes;
  if (patch.assignedTo !== undefined) dbPatch.assigned_to = patch.assignedTo;
  if (patch.mlFeedback !== undefined) dbPatch.ml_feedback = patch.mlFeedback;
  if (patch.mlFeedbackReason !== undefined) dbPatch.ml_feedback_reason = patch.mlFeedbackReason;
  if (patch.mlFeedbackAt !== undefined) dbPatch.ml_feedback_at = patch.mlFeedbackAt;
  const { error } = await supabase.from('leads').update(dbPatch).eq('id', id);
  if (error) {
    throw new Error(`Impossible de mettre à jour le prospect : ${error.message}`);
  }
}

/**
 * Persiste les coordonnées géocodées d'un lead (géocodage BAN de secours).
 * Évite de re-géocoder à chaque ouverture de la carte.
 */
export async function updateLeadCoordinates(
  supabase: Client,
  id: string,
  latitude: number,
  longitude: number,
): Promise<void> {
  const { error } = await supabase
    .from('leads')
    .update({ latitude, longitude } as Partial<LeadRow>)
    .eq('id', id);
  if (error) {
    throw new Error(`Impossible d'enregistrer les coordonnées : ${error.message}`);
  }
}

export async function deleteLead(supabase: Client, id: string): Promise<void> {
  const { error } = await supabase.from('leads').delete().eq('id', id);
  if (error) {
    throw new Error(`Impossible de supprimer le prospect : ${error.message}`);
  }
}
