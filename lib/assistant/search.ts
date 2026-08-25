/**
 * Recherche classique par mots-clés sur toute la base visible de l'agence.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { RecordViewer } from '@/lib/agency/visibility';
import { canSeeLeadRecord, canSeeOwnedRecord } from '@/lib/agency/visibility';
import { canSeeVoiceNote } from '@/lib/notes/visibility';
import { buildFullName } from '@/lib/queries/contacts';
import type { Database } from '@/types/database';
import {
  digitsOnly,
  escapeIlike,
  normalizeTexte,
  phoneIlikePattern,
  searchPatterns,
  significantSearchTokens,
} from './normalize';

export type SearchHitKind = 'lead' | 'contact' | 'bien' | 'note' | 'interaction';

export type SearchHit = {
  id: string;
  kind: SearchHitKind;
  label: string;
  subtitle: string;
  snippet: string | null;
  href: string;
};

export type SearchSuggestion = Pick<SearchHit, 'id' | 'kind' | 'label' | 'subtitle' | 'href'>;

const KIND_LABEL: Record<SearchHitKind, string> = {
  lead: 'Prospect',
  contact: 'Contact',
  bien: 'Bien',
  note: 'Dictée',
  interaction: 'Échange',
};

const INTERACTION_KIND: Record<string, string> = {
  note: 'Note',
  appel: 'Appel',
  visite: 'Visite',
  vocal: 'Vocal',
  email: 'E-mail',
};

export const SEARCH_MIN_LEN = 2;
export const SEARCH_ROW_LIMIT = 35;
export const SEARCH_MAX_HITS = 20;

type Client = SupabaseClient<Database>;

export function ilikePattern(q: string): string {
  return `%${escapeIlike(q.trim())}%`;
}

export function hrefLead(id: string): string {
  return `/dashboard/prospection?lead=${encodeURIComponent(id)}`;
}

export function hrefContact(id: string): string {
  return `/dashboard/contacts?fiche=${encodeURIComponent(id)}`;
}

export function hrefBien(id: string): string {
  return `/dashboard/biens?fiche=${encodeURIComponent(id)}`;
}

function hrefNote(contactId: string | null): string {
  if (contactId) return hrefContact(contactId);
  return '/dashboard/carte';
}

function scorePhoneMatch(query: string, phone: string | null | undefined): number {
  const qd = digitsOnly(query);
  if (qd.length < 4 || !phone) return 0;
  const pd = digitsOnly(phone);
  if (!pd) return 0;
  if (pd.startsWith(qd) || pd.includes(qd)) return 4;
  return 0;
}

function scoreMatch(query: string, ...fields: Array<string | null | undefined>): number {
  const q = normalizeTexte(query);
  const tokens = significantSearchTokens(query);
  if (!q && tokens.length === 0) return 0;
  let best = 0;
  for (const raw of fields) {
    if (!raw) continue;
    const n = normalizeTexte(raw);
    if (q && n.startsWith(q)) best = Math.max(best, 4);
    else if (q && n.includes(q)) best = Math.max(best, 3);
    if (tokens.length > 0 && tokens.every((t) => n.includes(t))) {
      best = Math.max(best, tokens.length === 1 ? 3 : 4);
    } else if (tokens.some((t) => t.length >= 4 && n.includes(t))) {
      best = Math.max(best, 2);
    }
  }
  return best;
}

function orIlike(fields: readonly string[], patterns: readonly string[]): string {
  return patterns
    .flatMap((p) => {
      const like = `%${escapeIlike(p)}%`;
      return fields.map((f) => `${f}.ilike."${like}"`);
    })
    .join(',');
}

function truncateSnippet(text: string, max = 88): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function addressLabel(row: {
  address: string;
  city: string | null;
  postal_code: string | null;
}): string {
  const tail = [row.postal_code?.trim(), row.city?.trim()].filter(Boolean).join(' ');
  return tail ? `${row.address}, ${tail}` : row.address;
}

export type SearchRows = {
  leads: Array<{
    id: string;
    address: string;
    city: string | null;
    postal_code: string | null;
    adresse_normalisee?: string | null;
    notes?: string | null;
    owner_name?: string | null;
    company_name?: string | null;
    assigned_to: string | null;
  }>;
  contacts: Array<{
    id: string;
    first_name: string | null;
    last_name: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    summary?: string | null;
    contact_type: string;
    assigned_to?: string | null;
    created_by: string | null;
  }>;
  biens: Array<{
    id: string;
    address: string;
    city: string | null;
    postal_code: string | null;
    adresse_normalisee?: string | null;
    notes?: string | null;
    listing_title?: string | null;
    listing_description?: string | null;
    property_type?: string | null;
    created_by: string | null;
  }>;
  notes: Array<{
    id: string;
    transcript: string | null;
    adresse_normalisee?: string | null;
    contact_id: string | null;
    created_by: string | null;
    visibilite?: string | null;
    created_at: string;
  }>;
  interactions: Array<{
    id: string;
    body: string;
    kind: string;
    contact_id: string;
    author_id: string | null;
    assigned_to?: string | null;
    occurred_at: string;
    contact?: { first_name: string | null; last_name: string | null } | null;
  }>;
};

export async function fetchSearchRows(
  supabase: Client,
  agencyId: string,
  query: string,
): Promise<SearchRows> {
  const patterns = searchPatterns(query);
  const phoneLike = phoneIlikePattern(query);
  const contactOr = [
    orIlike(
      ['first_name', 'last_name', 'address', 'phone', 'email', 'summary'],
      patterns,
    ),
    phoneLike ? `phone.ilike."${phoneLike}"` : '',
  ]
    .filter(Boolean)
    .join(',');

  const [leadsRes, contactsRes, biensRes, notesRes, interactionsRes] = await Promise.all([
    supabase
      .from('leads')
      .select(
        'id, address, city, postal_code, adresse_normalisee, notes, owner_name, company_name, assigned_to',
      )
      .eq('agency_id', agencyId)
      .or(
        orIlike(
          ['address', 'adresse_normalisee', 'postal_code', 'city', 'notes', 'owner_name', 'company_name'],
          patterns,
        ),
      )
      .order('created_at', { ascending: false })
      .limit(SEARCH_ROW_LIMIT),
    supabase
      .from('contacts')
      .select(
        'id, first_name, last_name, address, phone, email, summary, contact_type, assigned_to, created_by',
      )
      .eq('agency_id', agencyId)
      .or(contactOr)
      .order('created_at', { ascending: false })
      .limit(SEARCH_ROW_LIMIT),
    supabase
      .from('biens')
      .select(
        'id, address, city, postal_code, adresse_normalisee, notes, listing_title, listing_description, property_type, created_by',
      )
      .eq('agency_id', agencyId)
      .or(
        orIlike(
          [
            'address',
            'adresse_normalisee',
            'postal_code',
            'city',
            'notes',
            'listing_title',
            'listing_description',
            'property_type',
          ],
          patterns,
        ),
      )
      .order('created_at', { ascending: false })
      .limit(SEARCH_ROW_LIMIT),
    supabase
      .from('voice_notes')
      .select('id, transcript, adresse_normalisee, contact_id, created_by, visibilite, created_at')
      .eq('agency_id', agencyId)
      .or(orIlike(['transcript', 'adresse_normalisee'], patterns))
      .order('created_at', { ascending: false })
      .limit(SEARCH_ROW_LIMIT),
    supabase
      .from('contact_interactions')
      .select(
        'id, body, kind, contact_id, author_id, assigned_to, occurred_at, contact:contacts ( first_name, last_name )',
      )
      .eq('agency_id', agencyId)
      .or(orIlike(['body'], patterns))
      .order('occurred_at', { ascending: false })
      .limit(SEARCH_ROW_LIMIT),
  ]);

  return {
    leads: leadsRes.data ?? [],
    contacts: contactsRes.data ?? [],
    biens: biensRes.data ?? [],
    notes: notesRes.data ?? [],
    interactions: interactionsRes.data ?? [],
  };
}

export function buildSearchHits(
  query: string,
  rows: SearchRows,
  viewer: RecordViewer,
): SearchHit[] {
  const q = query.trim();
  if (q.length < SEARCH_MIN_LEN) return [];

  const out: Array<SearchHit & { score: number }> = [];
  const seen = new Set<string>();

  function push(hit: SearchHit & { score: number }) {
    const key = `${hit.kind}:${hit.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(hit);
  }

  for (const row of rows.leads) {
    if (!canSeeLeadRecord(viewer, { assignedTo: row.assigned_to })) continue;
    const label = addressLabel(row);
    const s = scoreMatch(
      q,
      label,
      row.address,
      row.adresse_normalisee,
      row.postal_code,
      row.city,
      row.notes,
      row.owner_name,
      row.company_name,
    );
    if (s === 0) continue;
    push({
      id: row.id,
      kind: 'lead',
      label,
      subtitle: KIND_LABEL.lead,
      snippet: row.owner_name ?? row.company_name ?? null,
      href: hrefLead(row.id),
      score: s + 1,
    });
  }

  for (const row of rows.contacts) {
    if (!canSeeOwnedRecord(viewer, { assignedTo: row.assigned_to ?? null, createdBy: row.created_by }))
      continue;
    const name = buildFullName(row.first_name ?? '', row.last_name ?? '') || 'Contact sans nom';
    const s = Math.max(scoreMatch(q, name, row.address, row.phone, row.email, row.summary), scorePhoneMatch(q, row.phone));
    if (s === 0) continue;
    push({
      id: row.id,
      kind: 'contact',
      label: name,
      subtitle: row.contact_type === 'acquereur' ? 'Acquéreur' : KIND_LABEL.contact,
      snippet: row.phone ?? row.email ?? row.address ?? null,
      href: hrefContact(row.id),
      score: s + 2,
    });
  }

  for (const row of rows.biens) {
    if (!canSeeOwnedRecord(viewer, { assignedTo: null, createdBy: row.created_by })) continue;
    const label = addressLabel(row);
    const s = scoreMatch(
      q,
      label,
      row.address,
      row.adresse_normalisee,
      row.postal_code,
      row.city,
      row.notes,
      row.listing_title,
      row.listing_description,
      row.property_type,
    );
    if (s === 0) continue;
    push({
      id: row.id,
      kind: 'bien',
      label,
      subtitle: KIND_LABEL.bien,
      snippet: row.listing_title ?? null,
      href: hrefBien(row.id),
      score: s,
    });
  }

  for (const row of rows.notes) {
    if (
      !canSeeVoiceNote(viewer, {
        visibilite: (row.visibilite === 'privee' ? 'privee' : 'agence') as 'agence' | 'privee',
        createdBy: row.created_by,
      })
    )
      continue;
    const s = scoreMatch(q, row.transcript, row.adresse_normalisee);
    if (s === 0) continue;
    const snippet = row.transcript ? truncateSnippet(row.transcript) : (row.adresse_normalisee ?? null);
    push({
      id: row.id,
      kind: 'note',
      label: row.adresse_normalisee ?? 'Dictée vocale',
      subtitle: KIND_LABEL.note,
      snippet,
      href: hrefNote(row.contact_id),
      score: s - 1,
    });
  }

  for (const row of rows.interactions) {
    if (
      !canSeeOwnedRecord(viewer, {
        assignedTo: row.assigned_to ?? null,
        createdBy: row.author_id,
      })
    )
      continue;
    const s = scoreMatch(q, row.body);
    if (s === 0) continue;
    const contact = row.contact;
    const contactName = contact
      ? buildFullName(contact.first_name ?? '', contact.last_name ?? '') || 'Contact'
      : 'Contact';
    push({
      id: row.id,
      kind: 'interaction',
      label: contactName,
      subtitle: INTERACTION_KIND[row.kind] ?? KIND_LABEL.interaction,
      snippet: truncateSnippet(row.body),
      href: hrefContact(row.contact_id),
      score: s - 1,
    });
  }

  return out
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label, 'fr'))
    .slice(0, SEARCH_MAX_HITS)
    .map(({ score: _s, ...hit }) => hit);
}

/** Alias rétrocompatible pour l'autocomplete. */
export function buildSuggestions(
  query: string,
  rows: Pick<SearchRows, 'leads' | 'contacts' | 'biens'>,
  viewer: RecordViewer,
): SearchSuggestion[] {
  return buildSearchHits(query, { ...rows, notes: [], interactions: [] }, viewer)
    .filter((h) => h.kind !== 'note' && h.kind !== 'interaction')
    .slice(0, 8)
    .map(({ id, kind, label, subtitle, href }) => ({ id, kind, label, subtitle, href }));
}

export function questionForSuggestion(s: SearchSuggestion): string {
  if (s.kind === 'contact') return `Des nouvelles de ${s.label} ?`;
  return `Qu'est-ce qu'on sait du ${s.label} ?`;
}
