import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import {
  PORTFOLIO_RDV_SANS_SUITE_DAYS,
  countRendezVousSansSuite,
} from '@/lib/today/portfolio';

type Client = SupabaseClient<Database>;

export type PastRendezVous = { contactId: string | null; fin: string };

/** RDV déjà terminés, pour le compteur « sans suite ». */
export async function fetchPastRendezVousSafe(supabase: Client): Promise<PastRendezVous[]> {
  const cutoff = new Date(
    Date.now() - PORTFOLIO_RDV_SANS_SUITE_DAYS * 86_400_000,
  ).toISOString();
  try {
    const { data, error } = await supabase
      .from('rendez_vous')
      .select('contact_id, fin')
      .lt('fin', cutoff)
      .order('fin', { ascending: false })
      .limit(400);
    if (error) throw error;
    return (data ?? []).map((row) => ({
      contactId: row.contact_id ? String(row.contact_id) : null,
      fin: String(row.fin),
    }));
  } catch (err) {
    console.error('[rendez_vous] lecture sans suite impossible', err);
    return [];
  }
}

export function sansSuiteContactIds(
  rdv: readonly PastRendezVous[],
  lastInteractionByContactId: Readonly<Record<string, string | null>>,
  now = Date.now(),
): string[] {
  const cutoff = now - PORTFOLIO_RDV_SANS_SUITE_DAYS * 86_400_000;
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const row of rdv) {
    const fin = Date.parse(row.fin);
    if (!Number.isFinite(fin) || fin > cutoff) continue;
    if (!row.contactId || seen.has(row.contactId)) continue;
    seen.add(row.contactId);
    const last = lastInteractionByContactId[row.contactId];
    if (last) {
      const t = Date.parse(last);
      if (Number.isFinite(t) && t > fin) continue;
    }
    ids.push(row.contactId);
  }
  return ids;
}

export function countSansSuite(
  rdv: readonly PastRendezVous[],
  lastInteractionByContactId: Readonly<Record<string, string | null>>,
  now = Date.now(),
): number {
  return countRendezVousSansSuite(rdv, lastInteractionByContactId, now);
}
