import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, LeadRow, ProfileRow } from '@/types/database';
import type { Lead, LeadSignal, MlFeedback, TeamMember } from '@/types/lead';
import { parseDisplaySignals } from '@/lib/display-signals';
import { parseContactsImmeuble, parseContactabilite, parseOwnerPhoneSource } from '@/lib/lead-contacts';
import { parseScriptApproche } from '@/lib/script-approche';
import { assignmentMeta } from '@/lib/agency/assignees';

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
    banId: row.ban_id ?? null,
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
    etage: row.etage ?? null,
    dpeClass: row.dpe_class,
    dpeDate: row.dpe_date,
    status: row.status,
    notes: row.notes,
    assignedTo: row.assigned_to,
    stageId: row.stage_id ?? null,
    stagePosition: row.stage_position != null ? Number(row.stage_position) : null,
    takenAt: row.taken_at ?? null,
    stageChangedAt: row.stage_changed_at ?? null,
    lostReason: row.lost_reason ?? null,
    mlFeedback: row.ml_feedback ?? null,
    mlFeedbackReason: row.ml_feedback_reason ?? null,
    mlFeedbackAt: row.ml_feedback_at ?? null,
    marcheStatut: row.marche_statut ?? null,
    marcheVerifieLe: row.marche_verifie_le ?? null,
    ownerName: row.owner_name ?? null,
    ownerAge: row.owner_age ?? null,
    ownerCompany: row.owner_company ?? null,
    ownerSiren: row.owner_siren ?? null,
    ownerPhone: row.owner_phone ?? null,
    ownerPhoneSource: parseOwnerPhoneSource(row.owner_phone_source),
    contactabilite: parseContactabilite(row.contactabilite),
    contactsImmeuble: parseContactsImmeuble(row.contacts_immeuble),
    scriptApproche: parseScriptApproche(row.script_approche),
    deliveredAt: row.delivered_at ?? row.created_at.slice(0, 10),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Colonnes exposées au client dashboard — exclut `internal_signals`.
 * Si une migration ajoute une colonne affichée, l'ajouter ici.
 */
const LEADS_CLIENT_COLUMNS = [
  'id',
  'agency_id',
  'address',
  'city',
  'postal_code',
  'property_type',
  'surface_m2',
  'owner_type',
  'company_name',
  'company_director',
  'company_phone',
  'company_email',
  'score',
  'signals',
  'display_signals',
  'latitude',
  'longitude',
  'acquired_year',
  'acquired_price',
  'acquired_price_reliable',
  'estimated_value',
  'estimation_low',
  'estimation_high',
  'estimation_confidence',
  'estimation_basis',
  'plus_value_pct',
  'rooms',
  'floor',
  'etage',
  'dpe_class',
  'dpe_date',
  'status',
  'notes',
  'assigned_to',
  'stage_id',
  'stage_position',
  'taken_at',
  'stage_changed_at',
  'lost_reason',
  'ml_feedback',
  'ml_feedback_reason',
  'ml_feedback_at',
  'marche_statut',
  'marche_verifie_le',
  'owner_name',
  'owner_age',
  'owner_company',
  'owner_siren',
  'owner_phone',
  'owner_phone_source',
  'contactabilite',
  'contacts_immeuble',
  'script_approche',
  'delivered_at',
  'created_at',
  'updated_at',
] as const;

const LEADS_BAN_COLUMNS = [
  'ban_id',
  'adresse_normalisee',
  'geocode_score',
  'geocode_le',
] as const;

export const LEADS_CLIENT_SELECT = [...LEADS_CLIENT_COLUMNS, ...LEADS_BAN_COLUMNS].join(',');
const LEADS_CLIENT_SELECT_LEGACY = LEADS_CLIENT_COLUMNS.join(',');

/**
 * Charge les leads de l'agence active (RLS).
 */
export async function fetchLeads(supabase: Client): Promise<Lead[]> {
  const first = await supabase
    .from('leads')
    .select(LEADS_CLIENT_SELECT)
    .order('score', { ascending: false })
    .order('created_at', { ascending: false });

  const result = first.error
    ? await supabase
        .from('leads')
        .select(LEADS_CLIENT_SELECT_LEGACY)
        .order('score', { ascending: false })
        .order('created_at', { ascending: false })
    : first;

  if (result.error) {
    throw new Error(`Impossible de charger les prospects : ${result.error.message}`);
  }
  return (result.data ?? []).map((row) => mapDbLeadToLead(row as unknown as LeadRow));
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
  const { data: links, error: linksError } = await supabase
    .from('profile_agencies')
    .select('profile_id')
    .eq('agency_id', agencyId);
  if (linksError) {
    throw new Error(`Impossible de charger l'équipe : ${linksError.message}`);
  }

  const profileIds = (links ?? []).map((l) => l.profile_id);
  if (profileIds.length === 0) return [];

  const { data, error } = await supabase
    .from('profiles')
    .select('id, first_name, last_name')
    .in('id', profileIds)
    .order('first_name', { ascending: true });
  if (error) {
    throw new Error(`Impossible de charger l'équipe : ${error.message}`);
  }
  return (data ?? []).map((p) =>
    mapProfileToTeamMember({
      id: p.id,
      first_name: p.first_name,
      last_name: p.last_name,
      phone: null,
      preferences: {},
      created_at: '',
      updated_at: '',
    }),
  );
}

export interface LeadPatch {
  status?: Lead['status'];
  notes?: string | null;
  assignedTo?: string | null;
  mlFeedback?: MlFeedback;
  mlFeedbackReason?: string | null;
  mlFeedbackAt?: string | null;
}

export async function updateLead(
  supabase: Client,
  id: string,
  patch: LeadPatch,
  actorId?: string,
): Promise<void> {
  const dbPatch: Partial<LeadRow> = {};
  if (patch.status !== undefined) dbPatch.status = patch.status;
  if (patch.notes !== undefined) dbPatch.notes = patch.notes;
  if (patch.assignedTo !== undefined) {
    if (actorId) {
      const meta = assignmentMeta(patch.assignedTo, actorId);
      dbPatch.assigned_to = meta.assigned_to;
      dbPatch.assigned_by = meta.assigned_by;
      dbPatch.assigned_at = meta.assigned_at;
    } else {
      dbPatch.assigned_to = patch.assignedTo;
    }
  }
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
  extra?: {
    banId?: string | null;
    adresseNormalisee?: string | null;
    geocodeScore?: number | null;
  },
): Promise<void> {
  const patch: Partial<LeadRow> = {
    latitude,
    longitude,
    geocode_le: new Date().toISOString(),
  };
  if (extra?.banId !== undefined) patch.ban_id = extra.banId;
  if (extra?.adresseNormalisee !== undefined) patch.adresse_normalisee = extra.adresseNormalisee;
  if (extra?.geocodeScore !== undefined) patch.geocode_score = extra.geocodeScore;
  const { error } = await supabase.from('leads').update(patch).eq('id', id);
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
