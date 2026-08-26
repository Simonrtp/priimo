import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { PUBLIC_DPE_MIN_AGE_MONTHS } from '@/lib/carte/dpe-public';

type Db = SupabaseClient<Database>;

/**
 * Recalcule building_activity après un import. Le seuil DPE n'existe qu'ici
 * (PUBLIC_DPE_MIN_AGE_MONTHS) — le SQL le reçoit en argument, sans INTERVAL en dur.
 */
export async function refreshBuildingActivity(
  db: Db,
  codesPostaux: readonly string[],
): Promise<number> {
  const codes = [...new Set(codesPostaux.filter((c) => /^\d{5}$/.test(c)))];
  if (codes.length === 0) {
    throw new Error('refreshBuildingActivity : au moins un code postal à 5 chiffres');
  }
  const { data, error } = await db.rpc('refresh_building_activity', {
    p_codes_postaux: codes,
    p_dpe_min_age_months: PUBLIC_DPE_MIN_AGE_MONTHS,
  });
  if (error) throw new Error(error.message);
  return typeof data === 'number' ? data : Number(data);
}
