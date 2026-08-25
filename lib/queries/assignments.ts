import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { buildFullName } from '@/lib/queries/contacts';

type Client = SupabaseClient<Database>;

export type TodayAssignmentItem = {
  kind: 'contact' | 'lead' | 'note';
  id: string;
  assignedByName: string;
  headline: string;
  context: string;
  contactId?: string;
  leadId?: string;
  assignedAt: string | null;
};

function isTransmis(assignedTo: string | null, assignedBy: string | null, me: string): boolean {
  return Boolean(assignedTo === me && assignedBy && assignedBy !== assignedTo);
}

/**
 * Fiches et notes qu'un collègue m'a transmises. Pas de carte si je me les
 * suis assignées moi-même.
 */
export async function fetchAssignmentsToMe(
  supabase: Client,
  profileId: string,
  namesById: ReadonlyMap<string, string>,
): Promise<TodayAssignmentItem[]> {
  try {
    const [contactsRes, leadsRes, notesRes] = await Promise.all([
      supabase
        .from('contacts')
        .select('id, first_name, last_name, contact_type, secteur, summary, assigned_to, assigned_by, assigned_at')
        .eq('assigned_to', profileId),
      supabase
        .from('leads')
        .select('id, address, assigned_to, assigned_by, assigned_at')
        .eq('assigned_to', profileId),
      supabase
        .from('contact_interactions')
        .select('id, contact_id, body, assigned_to, assigned_by, assigned_at')
        .eq('assigned_to', profileId)
        .order('assigned_at', { ascending: false })
        .limit(12),
    ]);

    const items: TodayAssignmentItem[] = [];

    for (const row of (contactsRes.data ?? []) as Array<{
      id: string;
      first_name: string | null;
      last_name: string | null;
      contact_type: string | null;
      secteur: string | null;
      summary: string | null;
      assigned_to: string | null;
      assigned_by: string | null;
      assigned_at: string | null;
    }>) {
      if (!isTransmis(row.assigned_to, row.assigned_by, profileId)) continue;
      const name = buildFullName(row.first_name ?? '', row.last_name ?? '') || 'Contact';
      const bits = [row.contact_type, row.secteur].filter(Boolean);
      items.push({
        kind: 'contact',
        id: row.id,
        assignedByName: namesById.get(row.assigned_by ?? '') ?? 'un collègue',
        headline: name,
        context: bits.join(' · ') || (row.summary ?? 'Fiche à reprendre'),
        contactId: row.id,
        assignedAt: row.assigned_at,
      });
    }

    for (const row of (leadsRes.data ?? []) as Array<{
      id: string;
      address: string;
      assigned_to: string | null;
      assigned_by: string | null;
      assigned_at: string | null;
    }>) {
      if (!isTransmis(row.assigned_to, row.assigned_by, profileId)) continue;
      items.push({
        kind: 'lead',
        id: row.id,
        assignedByName: namesById.get(row.assigned_by ?? '') ?? 'un collègue',
        headline: row.address,
        context: 'Adresse à travailler',
        leadId: row.id,
        assignedAt: row.assigned_at,
      });
    }

    for (const row of (notesRes.data ?? []) as Array<{
      id: string;
      contact_id: string;
      body: string;
      assigned_to: string | null;
      assigned_by: string | null;
      assigned_at: string | null;
    }>) {
      if (!isTransmis(row.assigned_to, row.assigned_by, profileId)) continue;
      items.push({
        kind: 'note',
        id: row.id,
        assignedByName: namesById.get(row.assigned_by ?? '') ?? 'un collègue',
        headline: 'Note transmise',
        context: row.body.slice(0, 140),
        contactId: row.contact_id,
        assignedAt: row.assigned_at,
      });
    }

    return items;
  } catch (err) {
    console.error('[assignments] lecture impossible', err);
    return [];
  }
}
