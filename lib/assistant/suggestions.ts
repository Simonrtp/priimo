import type { RecordViewer } from '@/lib/agency/visibility';
import { canSeeLeadRecord, canSeeOwnedRecord } from '@/lib/agency/visibility';
import { buildFullName } from '@/lib/queries/contacts';
import { escapeIlike, normalizeTexte } from './normalize';

export type SearchSuggestion = {
  id: string;
  kind: 'lead' | 'contact' | 'bien';
  label: string;
  subtitle: string;
};

const KIND_LABEL: Record<SearchSuggestion['kind'], string> = {
  lead: 'Prospect',
  contact: 'Contact',
  bien: 'Bien',
};

const MAX = 8;

function scoreMatch(query: string, ...fields: Array<string | null | undefined>): number {
  const q = normalizeTexte(query);
  if (!q) return 0;
  let best = 0;
  for (const raw of fields) {
    if (!raw) continue;
    const n = normalizeTexte(raw);
    if (n.startsWith(q)) best = Math.max(best, 3);
    else if (n.includes(q)) best = Math.max(best, 2);
    else {
      const tokens = q.split(' ').filter((t) => t.length >= 2);
      if (tokens.length > 0 && tokens.every((t) => n.includes(t))) best = Math.max(best, 1);
    }
  }
  return best;
}

function leadLabel(row: {
  address: string;
  city: string | null;
  postal_code: string | null;
}): string {
  const cp = row.postal_code?.trim();
  const city = row.city?.trim();
  const tail = [cp, city].filter(Boolean).join(' ');
  return tail ? `${row.address}, ${tail}` : row.address;
}

function bienLabel(row: {
  address: string;
  city: string | null;
  postal_code: string | null;
}): string {
  return leadLabel(row);
}

export function buildSuggestions(
  query: string,
  rows: {
    leads: Array<{
      id: string;
      address: string;
      city: string | null;
      postal_code: string | null;
      adresse_normalisee?: string | null;
      assigned_to: string | null;
    }>;
    contacts: Array<{
      id: string;
      first_name: string | null;
      last_name: string | null;
      address?: string | null;
      contact_type: string;
      assigned_to?: string | null;
      created_by: string | null;
    }>;
    biens: Array<{
      id: string;
      address: string;
      city: string | null;
      postal_code: string | null;
      created_by: string | null;
    }>;
  },
  viewer: RecordViewer,
): SearchSuggestion[] {
  const q = query.trim();
  if (q.length < 2) return [];

  const out: Array<SearchSuggestion & { score: number }> = [];
  const seen = new Set<string>();

  for (const row of rows.leads) {
    if (!canSeeLeadRecord(viewer, { assignedTo: row.assigned_to })) continue;
    const label = leadLabel(row);
    const s = scoreMatch(q, label, row.address, row.adresse_normalisee, row.postal_code, row.city);
    if (s === 0) continue;
    const key = `lead:${label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ id: row.id, kind: 'lead', label, subtitle: KIND_LABEL.lead, score: s + 1 });
  }

  for (const row of rows.contacts) {
    if (!canSeeOwnedRecord(viewer, { assignedTo: row.assigned_to ?? null, createdBy: row.created_by }))
      continue;
    const name = buildFullName(row.first_name ?? '', row.last_name ?? '') || 'Contact sans nom';
    const s = scoreMatch(q, name, row.address);
    if (s === 0) continue;
    const key = `contact:${name}:${row.address ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      id: row.id,
      kind: 'contact',
      label: name,
      subtitle: row.contact_type === 'acquereur' ? 'Acquéreur' : KIND_LABEL.contact,
      score: s,
    });
  }

  for (const row of rows.biens) {
    if (!canSeeOwnedRecord(viewer, { assignedTo: null, createdBy: row.created_by })) continue;
    const label = bienLabel(row);
    const s = scoreMatch(q, label, row.address, row.postal_code, row.city);
    if (s === 0) continue;
    const key = `bien:${label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ id: row.id, kind: 'bien', label, subtitle: KIND_LABEL.bien, score: s });
  }

  return out
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label, 'fr'))
    .slice(0, MAX)
    .map(({ score: _s, ...item }) => item);
}

export function questionForSuggestion(s: SearchSuggestion): string {
  if (s.kind === 'contact') return `Des nouvelles de ${s.label} ?`;
  return `Qu'est-ce qu'on sait du ${s.label} ?`;
}

export function ilikePattern(q: string): string {
  return `%${escapeIlike(q.trim())}%`;
}
