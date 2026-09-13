import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { destinataireValide, type NotificationInsert } from './types';

type Admin = SupabaseClient<Database>;

/**
 * Écriture serveur uniquement. Le client n'insère jamais.
 * Si l'acteur est le destinataire, on se tait : il le sait.
 */
export async function ecrireNotification(
  admin: Admin,
  input: NotificationInsert,
): Promise<boolean> {
  if (!destinataireValide(input.profileId, input.actorId)) return false;
  if (!input.agencyId || !input.titre.trim() || !input.lien.trim()) return false;

  const { error } = await admin.from('notifications').insert({
    agency_id: input.agencyId,
    profile_id: input.profileId,
    type: input.type,
    titre: input.titre.trim(),
    corps: input.corps.trim(),
    lien: input.lien.trim(),
    entite_type: input.entiteType ?? null,
    entite_id: input.entiteId ?? null,
    groupe_cle: input.groupeCle ?? null,
  });

  if (error) {
    console.error('[notifications] écriture', error.message);
    return false;
  }
  return true;
}

export async function ecrireNotifications(
  admin: Admin,
  inputs: readonly NotificationInsert[],
): Promise<number> {
  let n = 0;
  for (const input of inputs) {
    if (await ecrireNotification(admin, input)) n += 1;
  }
  return n;
}

/** Une alerte quotidienne ne s'écrit qu'une fois par clé et par destinataire. */
export async function notificationDejaEmise(
  admin: Admin,
  params: {
    agencyId: string;
    profileId: string;
    groupeCle: string;
    depuisIso: string;
  },
): Promise<boolean> {
  const { data, error } = await admin
    .from('notifications')
    .select('id')
    .eq('agency_id', params.agencyId)
    .eq('profile_id', params.profileId)
    .eq('groupe_cle', params.groupeCle)
    .gte('created_at', params.depuisIso)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[notifications] idempotence', error.message);
    return true;
  }
  return Boolean(data);
}

export async function purgerNotificationsLues(
  admin: Admin,
  maintenant = new Date(),
  retentionJours = 30,
): Promise<number> {
  const cutoff = new Date(maintenant.getTime() - retentionJours * 86_400_000).toISOString();
  const { data, error } = await admin
    .from('notifications')
    .delete()
    .not('lue_le', 'is', null)
    .lt('lue_le', cutoff)
    .select('id');

  if (error) {
    console.error('[notifications] purge', error.message);
    return 0;
  }
  return data?.length ?? 0;
}
