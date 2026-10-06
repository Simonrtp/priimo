import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { normalizeParcelleId } from '@/lib/carte/parcelle-id';

type Admin = SupabaseClient<Database>;

/** BAN → parcelle via l’index cadastre, sinon via les bâtiments. */
export async function parcelleIdDepuisBan(
  admin: Admin,
  banId: string | null | undefined,
): Promise<string | null> {
  const id = banId?.trim();
  if (!id || id.startsWith('gps:')) return null;

  const { data: adresse } = await admin
    .from('parcelle_adresses')
    .select('parcelle_id')
    .eq('ban_id', id)
    .limit(1)
    .maybeSingle();
  const viaAdresse = normalizeParcelleId(
    typeof adresse?.parcelle_id === 'string' ? adresse.parcelle_id : null,
  );
  if (viaAdresse) return viaAdresse;

  const { data: batiment } = await admin
    .from('buildings')
    .select('parcelle_id')
    .eq('ban_id', id)
    .limit(1)
    .maybeSingle();
  return normalizeParcelleId(
    typeof batiment?.parcelle_id === 'string' ? batiment.parcelle_id : null,
  );
}

/** Tous les BAN connus d’une parcelle (adresses + bâtiments). */
export async function bansDeLaParcelle(admin: Admin, parcelleId: string): Promise<string[]> {
  const id = normalizeParcelleId(parcelleId);
  if (!id) return [];
  const [adresses, batiments] = await Promise.all([
    admin.from('parcelle_adresses').select('ban_id').eq('parcelle_id', id),
    admin.from('buildings').select('ban_id').eq('parcelle_id', id),
  ]);
  return [
    ...new Set(
      [...(adresses.data ?? []), ...(batiments.data ?? [])]
        .map((r) => (r as { ban_id: string | null }).ban_id)
        .filter((ban): ban is string => Boolean(ban)),
    ),
  ].slice(0, 200);
}
