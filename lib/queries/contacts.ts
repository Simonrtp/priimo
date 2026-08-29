import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ContactInsert,
  ContactInteractionRow,
  ContactRow,
  Database,
  VoiceNoteRow,
} from '@/types/database';
import type {
  Contact,
  ContactInteraction,
  ContactType,
  SearchCriteria,
  VoiceNote,
} from '@/types/contact';

type Client = SupabaseClient<Database>;

export const CONTACTS_SELECT = `
  id, agency_id, created_by, first_name, last_name, contact_type, phone, email,
  secteur, address, postal_codes, budget_min, budget_max, surface_min, surface_max,
  rooms_min, summary, last_interaction_at, recontacter_le, doublon_de, source, lead_id,
  ban_id, latitude, longitude, adresse_normalisee, geocode_score, geocode_le,
  assigned_to, assigned_by, assigned_at, created_at, updated_at
`;

const CONTACTS_SELECT_MID = `
  id, agency_id, created_by, first_name, last_name, contact_type, phone, email,
  secteur, address, postal_codes, budget_min, budget_max, surface_min, surface_max,
  rooms_min, summary, last_interaction_at, source, lead_id,
  ban_id, latitude, longitude, adresse_normalisee, geocode_score, geocode_le,
  assigned_to, assigned_by, assigned_at, created_at, updated_at
`;

const CONTACTS_SELECT_LEGACY = `
  id, agency_id, created_by, first_name, last_name, contact_type, phone, email,
  secteur, postal_codes, budget_min, budget_max, surface_min, surface_max,
  rooms_min, summary, last_interaction_at, source, lead_id, created_at, updated_at
`;

const INTERACTIONS_SELECT =
  'id, agency_id, contact_id, author_id, kind, body, voice_note_id, assigned_to, assigned_by, assigned_at, occurred_at, created_at';
export const INTERACTIONS_SELECT_PUBLIC = INTERACTIONS_SELECT;
const INTERACTIONS_SELECT_LEGACY =
  'id, agency_id, contact_id, author_id, kind, body, voice_note_id, occurred_at, created_at';

function cleanText(v: string | null | undefined): string {
  return (v ?? '').trim();
}

export function buildFullName(firstName: string, lastName: string): string {
  return [firstName, lastName].map((s) => s.trim()).filter(Boolean).join(' ');
}

export function mapDbContactToContact(row: ContactRow): Contact {
  const firstName = cleanText(row.first_name);
  const lastName = cleanText(row.last_name);
  const criteria: SearchCriteria = {
    budgetMin: row.budget_min,
    budgetMax: row.budget_max,
    surfaceMin: row.surface_min,
    surfaceMax: row.surface_max,
    roomsMin: row.rooms_min,
    postalCodes: Array.isArray(row.postal_codes) ? row.postal_codes.filter(Boolean) : [],
  };

  return {
    id: row.id,
    agencyId: row.agency_id,
    createdBy: row.created_by,
    firstName,
    lastName,
    fullName: buildFullName(firstName, lastName) || 'Contact sans nom',
    type: row.contact_type,
    phone: cleanText(row.phone) || null,
    email: cleanText(row.email) || null,
    secteur: cleanText(row.secteur) || null,
    address: cleanText(row.address) || null,
    banId: row.ban_id ?? null,
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    criteria,
    summary: cleanText(row.summary) || null,
    lastInteractionAt: row.last_interaction_at,
    recontacterLe: row.recontacter_le ?? null,
    doublonDe: row.doublon_de ?? null,
    source: row.source,
    leadId: row.lead_id,
    assignedTo: row.assigned_to ?? row.created_by ?? null,
    assignedBy: row.assigned_by ?? null,
    assignedAt: row.assigned_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchContacts(supabase: Client): Promise<Contact[]> {
  const first = await supabase
    .from('contacts')
    .select(CONTACTS_SELECT)
    .order('created_at', { ascending: false });

  const second = first.error
    ? await supabase.from('contacts').select(CONTACTS_SELECT_MID).order('created_at', { ascending: false })
    : first;
  const result = second.error
    ? await supabase.from('contacts').select(CONTACTS_SELECT_LEGACY).order('created_at', { ascending: false })
    : second;

  if (result.error) throw new Error(result.error.message);
  return ((result.data ?? []) as unknown as ContactRow[]).map(mapDbContactToContact);
}

export async function fetchContactById(supabase: Client, id: string): Promise<Contact | null> {
  const first = await supabase.from('contacts').select(CONTACTS_SELECT).eq('id', id).maybeSingle();
  const second = first.error
    ? await supabase.from('contacts').select(CONTACTS_SELECT_MID).eq('id', id).maybeSingle()
    : first;
  const result = second.error
    ? await supabase.from('contacts').select(CONTACTS_SELECT_LEGACY).eq('id', id).maybeSingle()
    : second;

  if (result.error) throw new Error(result.error.message);
  return result.data ? mapDbContactToContact(result.data as unknown as ContactRow) : null;
}

/**
 * Tant que la migration `20260820_workspace_contacts_biens.sql` n'est pas
 * appliquée, la table n'existe pas. L'écran Aujourd'hui doit continuer à
 * fonctionner avec les seuls leads plutôt que de renvoyer une erreur 500.
 */
export async function fetchContactsSafe(supabase: Client): Promise<Contact[]> {
  try {
    return await fetchContacts(supabase);
  } catch (err) {
    console.error('[contacts] lecture impossible, écran dégradé', err);
    return [];
  }
}

const DUP_SELECT =
  'id, agency_id, created_by, first_name, last_name, phone, email, doublon_de, assigned_to, contact_type';
const DUP_SELECT_LEGACY =
  'id, agency_id, created_by, first_name, last_name, phone, email, assigned_to, contact_type';

/**
 * Champs minimaux pour la détection de doublons à la création.
 * Beaucoup plus léger que fetchContactsSafe (pas de critères, pas de géocode).
 */
export async function fetchContactsDuplicateLite(supabase: Client): Promise<Contact[]> {
  try {
    const first = await supabase
      .from('contacts')
      .select(DUP_SELECT)
      .order('updated_at', { ascending: false })
      .limit(2500);
    const result = first.error
      ? await supabase
          .from('contacts')
          .select(DUP_SELECT_LEGACY)
          .order('created_at', { ascending: false })
          .limit(2500)
      : first;
    if (result.error) throw new Error(result.error.message);
    return ((result.data ?? []) as unknown as ContactRow[]).map(mapDbContactToContact);
  } catch (err) {
    console.error('[contacts] lecture doublons', err);
    return [];
  }
}

/**
 * Insertion compatible avec une base qui n’a pas encore
 * `20260835_contacts_relance_types.sql` (pas de recontacter_le / doublon_de).
 */
export async function insertContactRow(
  supabase: Client,
  row: ContactInsert,
): Promise<{ data: ContactRow | null; error: { message: string; code?: string } | null }> {
  const full = await supabase.from('contacts').insert(row).select(CONTACTS_SELECT).single();
  if (!full.error && full.data) {
    return { data: full.data as unknown as ContactRow, error: null };
  }

  const missingRelance =
    full.error?.code === 'PGRST204' &&
    typeof full.error.message === 'string' &&
    (full.error.message.includes('recontacter_le') || full.error.message.includes('doublon_de'));

  if (!missingRelance) {
    return { data: null, error: full.error };
  }

  const { recontacter_le: _r, doublon_de: _d, ...withoutRelance } = row;
  void _r;
  void _d;
  const mid = await supabase
    .from('contacts')
    .insert(withoutRelance as ContactInsert)
    .select(CONTACTS_SELECT_MID)
    .single();

  if (mid.error || !mid.data) {
    return { data: null, error: mid.error ?? full.error };
  }

  return {
    data: {
      ...(mid.data as unknown as ContactRow),
      recontacter_le: (row.recontacter_le as string | null | undefined) ?? null,
      doublon_de: null,
    },
    error: null,
  };
}

export function mapDbInteraction(row: ContactInteractionRow): ContactInteraction {
  return {
    id: row.id,
    contactId: row.contact_id,
    authorId: row.author_id,
    kind: row.kind,
    body: row.body,
    voiceNoteId: row.voice_note_id,
    occurredAt: row.occurred_at,
    assignedTo: row.assigned_to ?? null,
    assignedBy: row.assigned_by ?? null,
  };
}

export async function fetchContactInteractions(
  supabase: Client,
  contactId: string,
): Promise<ContactInteraction[]> {
  const first = await supabase
    .from('contact_interactions')
    .select(INTERACTIONS_SELECT)
    .eq('contact_id', contactId)
    .order('occurred_at', { ascending: false });
  const result = first.error
    ? await supabase
        .from('contact_interactions')
        .select(INTERACTIONS_SELECT_LEGACY)
        .eq('contact_id', contactId)
        .order('occurred_at', { ascending: false })
    : first;

  if (result.error) throw new Error(result.error.message);
  return ((result.data ?? []) as unknown as ContactInteractionRow[]).map(mapDbInteraction);
}

export function postalCodeFromVoiceNote(row: {
  adresse_normalisee?: string | null;
  structured?: unknown;
}): string | null {
  if (row.structured && typeof row.structured === 'object') {
    const structured = row.structured as Record<string, unknown>;
    const codes = Array.isArray(structured.postalCodes)
      ? structured.postalCodes.filter((c): c is string => typeof c === 'string')
      : [];
    const fromList = codes.find((c) => /^\d{5}$/.test(c));
    if (fromList) return fromList;
  }
  const label = row.adresse_normalisee ?? '';
  const match = label.match(/\b(\d{5})\b/);
  return match?.[1] ?? null;
}

export function mapDbVoiceNote(
  row: VoiceNoteRow,
  extra?: { hasFicheLink?: boolean },
): VoiceNote {
  const visibilite = row.visibilite === 'privee' ? 'privee' : 'agence';
  return {
    id: row.id,
    agencyId: row.agency_id,
    createdBy: row.created_by,
    durationSeconds: row.duration_seconds,
    transcript: row.transcript,
    transcriptOriginal: row.transcript_original ?? null,
    status: row.status,
    statut: row.statut === 'revue' ? 'revue' : 'brute',
    visibilite,
    sourceInfo: row.source_info ?? null,
    contactId: row.contact_id,
    banId: row.ban_id ?? null,
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    adresseNormalisee: row.adresse_normalisee ?? null,
    assignedTo: row.assigned_to ?? null,
    postalCode: postalCodeFromVoiceNote(row),
    createdAt: row.created_at,
    hasAudio: Boolean(row.mime_type && row.mime_type !== 'text/plain'),
    hasFicheLink: extra?.hasFicheLink ?? Boolean(row.contact_id),
  };
}

const VOICE_NOTES_SELECT = `
  id, agency_id, created_by, duration_seconds, transcript, transcript_original, status, statut, visibilite,
  source_info, contact_id, ban_id, latitude, longitude, adresse_normalisee, assigned_to,
  created_at, structured, mime_type
`;
const VOICE_NOTES_SELECT_MID = `
  id, agency_id, created_by, duration_seconds, transcript, status, statut, visibilite,
  source_info, contact_id, ban_id, latitude, longitude, adresse_normalisee, assigned_to,
  created_at, structured, mime_type
`;
const VOICE_NOTES_SELECT_LEGACY =
  'id, agency_id, created_by, duration_seconds, transcript, status, contact_id, created_at';

export async function fetchVoiceNotesSafe(supabase: Client): Promise<VoiceNote[]> {
  try {
    const first = await supabase
      .from('voice_notes')
      .select(VOICE_NOTES_SELECT)
      .order('created_at', { ascending: false });
    const second = first.error
      ? await supabase
          .from('voice_notes')
          .select(VOICE_NOTES_SELECT_MID)
          .order('created_at', { ascending: false })
      : first;
    const result = second.error
      ? await supabase
          .from('voice_notes')
          .select(VOICE_NOTES_SELECT_LEGACY)
          .order('created_at', { ascending: false })
      : second;
    if (result.error) throw new Error(result.error.message);
    const rows = (result.data ?? []) as unknown as VoiceNoteRow[];
    const ids = rows.map((r) => r.id);
    const ficheIds = new Set<string>();
    if (ids.length > 0) {
      try {
        const liens = await supabase
          .from('note_liens')
          .select('note_id, entite_type')
          .in('note_id', ids);
        if (!liens.error) {
          for (const lien of liens.data ?? []) {
            const type = (lien as { entite_type?: string }).entite_type;
            if (type === 'contact' || type === 'bien' || type === 'lead') {
              ficheIds.add((lien as { note_id: string }).note_id);
            }
          }
        }
      } catch {
        // table absente tant que la migration n'est pas appliquée
      }
    }
    return rows.map((row) =>
      mapDbVoiceNote(row, { hasFicheLink: ficheIds.has(row.id) || Boolean(row.contact_id) }),
    );
  } catch (err) {
    console.error('[voice_notes] lecture impossible, écran dégradé', err);
    return [];
  }
}

export interface ContactPatch {
  firstName?: string;
  lastName?: string;
  type?: ContactType;
  phone?: string | null;
  email?: string | null;
  secteur?: string | null;
  address?: string | null;
  summary?: string | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  surfaceMin?: number | null;
  surfaceMax?: number | null;
  roomsMin?: number | null;
  postalCodes?: string[];
  assignedTo?: string | null;
  recontacterLe?: string | null;
}

/** Traduit un patch domaine en colonnes DB. Les clés absentes ne sont pas touchées. */
export function contactPatchToRow(patch: ContactPatch): Partial<ContactRow> {
  const row: Partial<ContactRow> = {};
  if (patch.firstName !== undefined) row.first_name = patch.firstName.trim() || null;
  if (patch.lastName !== undefined) row.last_name = patch.lastName.trim() || null;
  if (patch.type !== undefined) row.contact_type = patch.type;
  if (patch.phone !== undefined) row.phone = patch.phone?.trim() || null;
  if (patch.email !== undefined) row.email = patch.email?.trim() || null;
  if (patch.secteur !== undefined) row.secteur = patch.secteur?.trim() || null;
  if (patch.address !== undefined) row.address = patch.address?.trim() || null;
  if (patch.summary !== undefined) row.summary = patch.summary?.trim() || null;
  if (patch.budgetMin !== undefined) row.budget_min = patch.budgetMin;
  if (patch.budgetMax !== undefined) row.budget_max = patch.budgetMax;
  if (patch.surfaceMin !== undefined) row.surface_min = patch.surfaceMin;
  if (patch.surfaceMax !== undefined) row.surface_max = patch.surfaceMax;
  if (patch.roomsMin !== undefined) row.rooms_min = patch.roomsMin;
  if (patch.postalCodes !== undefined) row.postal_codes = patch.postalCodes;
  if (patch.assignedTo !== undefined) row.assigned_to = patch.assignedTo;
  if (patch.recontacterLe !== undefined) row.recontacter_le = patch.recontacterLe;
  return row;
}

export type LatestInteractionRef = {
  kind: ContactInteraction['kind'];
  occurredAt: string;
};

/** Dernier échange réel par contact, lu dans contact_interactions — pas last_interaction_at. */
export async function fetchLatestInteractionsSafe(
  supabase: Client,
  contactIds: string[],
): Promise<Record<string, LatestInteractionRef>> {
  const ids = [...new Set(contactIds.filter(Boolean))];
  if (ids.length === 0) return {};
  try {
    const out: Record<string, LatestInteractionRef> = {};
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200);
      const { data, error } = await supabase
        .from('contact_interactions')
        .select('contact_id, kind, occurred_at')
        .in('contact_id', chunk)
        .order('occurred_at', { ascending: false });
      if (error) continue;
      for (const row of data ?? []) {
        const id = (row as { contact_id: string }).contact_id;
        if (out[id]) continue;
        out[id] = {
          kind: (row as { kind: ContactInteraction['kind'] }).kind,
          occurredAt: (row as { occurred_at: string }).occurred_at,
        };
      }
    }
    return out;
  } catch (err) {
    console.error('[contacts] dernières interactions', err);
    return {};
  }
}

export async function fetchLeadAddressesSafe(
  supabase: Client,
  leadIds: string[],
): Promise<Record<string, string>> {
  const ids = [...new Set(leadIds.filter(Boolean))];
  if (ids.length === 0) return {};
  try {
    const { data, error } = await supabase.from('leads').select('id, address').in('id', ids);
    if (error) return {};
    const out: Record<string, string> = {};
    for (const row of data ?? []) {
      const id = (row as { id: string }).id;
      const address = typeof (row as { address?: string | null }).address === 'string'
        ? (row as { address: string }).address.trim()
        : '';
      if (address) out[id] = address;
    }
    return out;
  } catch {
    return {};
  }
}
