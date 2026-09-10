import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { fetchZonesSafe } from '@/lib/queries/zones';
import { fetchMembersOfMyAgency } from '@/lib/queries/agency-members';
import type { SecteursData } from '@/components/dashboard/settings/SectionSecteurs';

type Client = SupabaseClient<Database>;

/**
 * Données de l'écran des secteurs.
 *
 * On ne charge pas les leads complets : l'écran n'a besoin que d'un point et
 * d'une date par adresse, pour poser les repères orange et équilibrer un
 * découpage. Tirer trente colonnes ici alourdirait les paramètres pour rien.
 */
export async function fetchSecteursSettings(
  supabase: Client,
  params: {
    agencyId: string;
    profileId: string;
    memberships: Parameters<typeof fetchMembersOfMyAgency>[1];
    centre: { latitude: number | null; longitude: number | null };
  },
): Promise<SecteursData> {
  const [zones, membres, leads] = await Promise.all([
    fetchZonesSafe(supabase),
    fetchMembersOfMyAgency(params.agencyId, params.memberships),
    supabase
      .from('leads')
      .select('id, address, postal_code, latitude, longitude, assigned_to, stage_id, delivered_at, created_at')
      .eq('agency_id', params.agencyId),
  ]);

  if (leads.error) {
    console.error('[secteurs] leads illisibles, carte sans repères', leads.error);
  }

  const points = (leads.data ?? [])
    .filter(
      (l): l is typeof l & { latitude: number; longitude: number } =>
        typeof l.latitude === 'number' && typeof l.longitude === 'number',
    )
    .map((l) => ({
      id: l.id,
      address: l.address,
      postalCode: l.postal_code,
      latitude: l.latitude,
      longitude: l.longitude,
      assignedTo: l.assigned_to,
      stageId: l.stage_id ?? null,
      pris: l.stage_id != null,
      deliveredAt: l.delivered_at ?? null,
      createdAt: l.created_at,
    }));

  return {
    zones,
    membres: membres.map((m) => ({ id: m.id, fullName: m.fullName })),
    leads: points,
    centre: params.centre,
    profileId: params.profileId,
  };
}
