import type { SupabaseClient } from '@supabase/supabase-js';
import {
  estTypeNotification,
  type Notification,
  type NotificationEntiteType,
} from '@/lib/notifications/types';
import type { Database, NotificationRow } from '@/types/database';

type Client = SupabaseClient<Database>;

const SELECT =
  'id, agency_id, profile_id, type, titre, corps, lien, entite_type, entite_id, lue_le, groupe_cle, created_at';

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
    entiteType: (row.entite_type as NotificationEntiteType | null) ?? null,
    entiteId: row.entite_id,
    lueLe: row.lue_le,
    groupeCle: row.groupe_cle,
    createdAt: row.created_at,
  };
}

/**
 * Notifications du visiteur, agence active. La RLS refuse le reste ;
 * le filtre applicatif est un filet, pas la garantie.
 */
export async function fetchNotifications(
  supabase: Client,
  params: { profileId: string; agencyId: string },
): Promise<Notification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select(SELECT)
    .eq('profile_id', params.profileId)
    .eq('agency_id', params.agencyId)
    .order('created_at', { ascending: false })
    .limit(80);

  if (error) {
    if (/notifications|schema cache|does not exist/i.test(error.message)) return [];
    console.error('[notifications] lecture', error.message);
    return [];
  }

  return ((data ?? []) as NotificationRow[])
    .map(versNotification)
    .filter((n): n is Notification => n !== null);
}

export async function fetchNotificationsSafe(
  supabase: Client,
  params: { profileId: string; agencyId: string },
): Promise<Notification[]> {
  try {
    return await fetchNotifications(supabase, params);
  } catch (err) {
    console.error('[notifications] lecture impossible', err);
    return [];
  }
}

export async function marquerNotificationLue(
  supabase: Client,
  params: { id: string; profileId: string; agencyId: string },
): Promise<boolean> {
  const { error } = await supabase
    .from('notifications')
    .update({ lue_le: new Date().toISOString() })
    .eq('id', params.id)
    .eq('profile_id', params.profileId)
    .eq('agency_id', params.agencyId)
    .is('lue_le', null);

  if (error) {
    console.error('[notifications] marquage', error.message);
    return false;
  }
  return true;
}

export async function marquerToutesLues(
  supabase: Client,
  params: { profileId: string; agencyId: string },
): Promise<boolean> {
  const { error } = await supabase
    .from('notifications')
    .update({ lue_le: new Date().toISOString() })
    .eq('profile_id', params.profileId)
    .eq('agency_id', params.agencyId)
    .is('lue_le', null);

  if (error) {
    console.error('[notifications] tout lu', error.message);
    return false;
  }
  return true;
}
