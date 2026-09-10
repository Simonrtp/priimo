import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { chevauchements } from '@/lib/zones/geometrie';
import { fetchZones } from './zones';

type Client = SupabaseClient<Database>;

/**
 * Si le secteur qu'on vient de retoucher empiète, on prévient le directeur.
 * On n'empêche rien : l'arbitrage n'est pas le logiciel.
 */
export async function signalerChevauchementsSiBesoin(params: {
  supabase: Client;
  agencyId: string;
  createdBy: string;
  zoneId: string;
}): Promise<void> {
  try {
    const zones = await fetchZones(params.supabase);
    const conflits = chevauchements(zones).filter(
      (c) => c.zoneA.id === params.zoneId || c.zoneB.id === params.zoneId,
    );
    if (conflits.length === 0) return;

    const { data: existantes } = await params.supabase
      .from('agency_alerts')
      .select('body')
      .eq('agency_id', params.agencyId)
      .eq('kind', 'chevauchement_zones')
      .limit(40);
    const deja = new Set((existantes ?? []).map((a) => a.body));

    for (const c of conflits) {
      const body = `${c.zoneA.nom} et ${c.zoneB.nom} se recouvrent.`;
      if (deja.has(body)) continue;
      const { error } = await params.supabase.from('agency_alerts').insert({
        agency_id: params.agencyId,
        created_by: params.createdBy,
        kind: 'chevauchement_zones',
        body,
      });
      if (error) {
        console.error('[zones] alerte de chevauchement', error.message);
      }
    }
  } catch (err) {
    console.error('[zones] lecture des chevauchements impossible', err);
  }
}
