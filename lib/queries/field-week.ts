import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { Contact } from '@/types/contact';
import type { Lead } from '@/types/lead';
import { buildFieldWeek, type FieldWeekSnapshot } from '@/lib/today/semaine';

type Client = SupabaseClient<Database>;

type NoteLite = { created_at: string; ban_id: string | null; structured: unknown | null };

/**
 * Notes de l’agent pour la série et le bilan de semaine.
 * Tolère l’absence de colonnes BAN tant que la migration n’est pas appliquée.
 */
export async function fetchFieldWeek(params: {
  supabase: Client;
  profileId: string;
  contacts: readonly Contact[];
  leads: readonly Lead[];
  now?: Date;
}): Promise<FieldWeekSnapshot> {
  const { supabase, profileId, contacts, leads, now = new Date() } = params;
  const since = new Date(now.getTime() - 90 * 86_400_000).toISOString();

  let notes: NoteLite[] = [];
  try {
    const full = await supabase
      .from('voice_notes')
      .select('created_at, ban_id, structured')
      .eq('created_by', profileId)
      .gte('created_at', since)
      .limit(500);
    if (full.error) {
      const legacy = await supabase
        .from('voice_notes')
        .select('created_at')
        .eq('created_by', profileId)
        .gte('created_at', since)
        .limit(500);
      notes = ((legacy.data ?? []) as { created_at: string }[]).map((r) => ({
        created_at: r.created_at,
        ban_id: null,
        structured: null,
      }));
    } else {
      notes = (full.data ?? []) as NoteLite[];
    }
  } catch (err) {
    console.error('[today] notes de semaine', err);
  }

  return buildFieldWeek({
    noteCreatedAt: notes.map((n) => n.created_at),
    noteBanIds: notes.map((n) => n.ban_id),
    noteStructured: notes.map((n) => n.structured),
    contactCreatedAt: contacts
      .filter((c) => c.createdBy === profileId)
      .map((c) => c.createdAt),
    leadDeliveredAt: leads.map((l) => l.deliveredAt ?? l.createdAt),
    now,
  });
}
