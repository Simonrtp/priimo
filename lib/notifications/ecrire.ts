import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, NotificationRow } from '@/types/database';
import {
  destinataireValide,
  estTypeNotification,
  type Notification,
  type NotificationInsert,
} from './types';

type Admin = SupabaseClient<Database>;

function versNotification(row: NotificationRow): Notification | null {
  if (!estTypeNotification(row.type)) return null;
  return {
    id: row.id,
    agencyId: row.agency_id,
    profileId: row.profile_id,
    type: row.type,
    titre: row.titre,
    corps: row.corps,
    lien: row.lien,
    entiteType: (row.entite_type as Notification['entiteType']) ?? null,
    entiteId: row.entite_id,
    lueLe: row.lue_le,
    groupeCle: row.groupe_cle,
    createdAt: row.created_at,
  };
}

/**
 * Écriture serveur uniquement. Le client n'insère jamais.
 * Si l'acteur est le destinataire, on se tait — sauf mémoire propre.
 * Retourne la ligne créée, ou null si refus / erreur.
 */
export async function ecrireNotification(
  admin: Admin,
  input: NotificationInsert,
): Promise<Notification | null> {
  if (!destinataireValide(input.profileId, input.actorId, input.memoirePropre)) return null;
  if (!input.agencyId || !input.titre.trim() || !input.lien.trim()) return null;

  const { data, error } = await admin
    .from('notifications')
    .insert({
      agency_id: input.agencyId,
      profile_id: input.profileId,
      type: input.type,
      titre: input.titre.trim(),
      corps: input.corps.trim(),
      lien: input.lien.trim(),
      entite_type: input.entiteType ?? null,
      entite_id: input.entiteId ?? null,
      groupe_cle: input.groupeCle ?? null,
      ...(input.dejaLue ? { lue_le: new Date().toISOString() } : {}),
    })
    .select(
      'id, agency_id, profile_id, type, titre, corps, lien, entite_type, entite_id, lue_le, groupe_cle, created_at',
    )
    .maybeSingle();

  if (error) {
    console.error('[notifications] écriture', error.message);
    return null;
  }
  return data ? versNotification(data as NotificationRow) : null;
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
