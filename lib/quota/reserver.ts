import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { Plafonds } from './regles';

export type Reservation = 'ok' | 'plafond' | 'indisponible';

function fonctionAbsente(erreur: { code?: string; message?: string }): boolean {
  return erreur.code === 'PGRST202' || erreur.code === '42883' || /could not find the function|does not exist/i.test(erreur.message ?? '');
}

/**
 * Réserve un appel payant pour l'agent connecté, sur le compteur commun à
 * tous les serveurs (migration 20261020_quotas_garde_fous). Atomique.
 *
 * « indisponible » : compteur absent ou base muette. À chaque appelant de
 * décider : Bright Data refuse (rien ne part sans compteur), l'IA retombe sur
 * son ancien plafond par agent.
 */
export async function reserverQuota(
  usage: string,
  plafonds: Plafonds,
  qui?: { profileId: string; agencyId: string },
): Promise<Reservation> {
  let identite = qui;
  if (!identite) {
    const { profile, agency } = await getServerUser();
    if (!profile || !agency) return 'plafond';
    identite = { profileId: profile.id, agencyId: agency.id };
  }
  try {
    const admin = createSupabaseAdminClient() as unknown as SupabaseClient;
    const { data, error } = await admin.rpc('quota_reserver', {
      p_profile: identite.profileId,
      p_agency: identite.agencyId,
      p_usage: usage,
      p_plafond_agent: plafonds.agent,
      p_plafond_agence: plafonds.agence,
      p_plafond_global: plafonds.global,
    });
    if (error) {
      if (!fonctionAbsente(error)) console.error('[quota]', usage, error.message);
      return 'indisponible';
    }
    return data === true ? 'ok' : 'plafond';
  } catch (err) {
    console.error('[quota]', usage, err instanceof Error ? err.message : err);
    return 'indisponible';
  }
}
