import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { normalizeParcelleId } from '@/lib/carte/parcelle-id';
import { ficheAdresseBan } from '@/lib/geo/ban';
import { fetchParcelleAuPoint } from '@/lib/geo/cadastre-point';

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

/** Une adresse absente de l'index, trouvée ailleurs : on la retient pour toutes les lectures suivantes. */
export async function retenirAdresseDeParcelle(
  admin: Admin,
  args: { banId: string; parcelleId: string; source: 'ban' | 'apicarto'; codePostal?: string | null },
): Promise<void> {
  const parcelleId = normalizeParcelleId(args.parcelleId);
  const banId = args.banId.trim();
  if (!parcelleId || !banId || banId.startsWith('gps:')) return;
  const { error } = await admin.from('parcelle_adresses').upsert(
    {
      parcelle_id: parcelleId,
      ban_id: banId,
      source: args.source,
      code_postal: args.codePostal && /^\d{5}$/.test(args.codePostal) ? args.codePostal : null,
      created_at: new Date().toISOString(),
    },
    { onConflict: 'parcelle_id,ban_id', ignoreDuplicates: true },
  );
  if (error) console.error('[parcelle] index adresse', error.message);
}

/** BAN → parcelle : l'index, sinon la BAN (lien officiel), sinon le cadastre IGN ; l'index retient le résultat. */
export async function parcelleDeLAdresse(
  admin: Admin,
  adresse: { banId: string; codePostal?: string | null; parIgn?: boolean },
): Promise<string | null> {
  const connue = await parcelleIdDepuisBan(admin, adresse.banId);
  if (connue) return connue;
  const fiche = await ficheAdresseBan(adresse.banId);
  if (!fiche) return null;
  const codePostal = adresse.codePostal ?? fiche.codePostal;

  const officielle = fiche.parcelles.map((p) => normalizeParcelleId(p)).find((p): p is string => Boolean(p));
  if (officielle) {
    await retenirAdresseDeParcelle(admin, { banId: adresse.banId, parcelleId: officielle, source: 'ban', codePostal });
    return officielle;
  }
  if (adresse.parIgn === false) return null;
  const auPoint = await fetchParcelleAuPoint({ latitude: fiche.latitude, longitude: fiche.longitude });
  const parcelleId = normalizeParcelleId(auPoint?.parcelleId ?? null);
  if (!parcelleId) return null;
  await retenirAdresseDeParcelle(admin, { banId: adresse.banId, parcelleId, source: 'apicarto', codePostal });
  return parcelleId;
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
