/**
 * Stats d'origine des contacts (vendeur / acquéreur) — direction.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type OrigineBucket = {
  source: string;
  vendeur: number;
  acquereur: number;
  total: number;
};

export async function fetchOriginesStats(
  admin: SupabaseClient,
  agencyId: string,
): Promise<OrigineBucket[]> {
  const { data, error } = await admin
    .from('contacts')
    .select('source, contact_type')
    .eq('agency_id', agencyId);

  if (error) throw error;

  const map = new Map<string, OrigineBucket>();
  for (const row of data ?? []) {
    const source = (row.source as string) || 'manuel';
    const bucket = map.get(source) ?? { source, vendeur: 0, acquereur: 0, total: 0 };
    if (row.contact_type === 'vendeur') bucket.vendeur += 1;
    else if (row.contact_type === 'acquereur') bucket.acquereur += 1;
    bucket.total += 1;
    map.set(source, bucket);
  }

  return [...map.values()].sort((a, b) => b.total - a.total);
}
