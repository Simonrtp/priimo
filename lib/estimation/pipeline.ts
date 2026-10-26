import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { poussePipelineEstimation, type EstimationEtat } from '@/lib/estimation/cycle';
import { entrerDansLePipeline } from '@/lib/pipeline/entrer-serveur';

type Db = SupabaseClient<Database>;

/** Ce que l'estimation sait du bien : de quoi le poser au pipeline. */
export type EstimationAuPipeline = {
  id: string;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  ban_id: string | null;
  property_type: string | null;
  surface_m2: number | null;
  rooms: number | null;
  dpe_class: string | null;
  price_value: number | null;
  bien_id: string | null;
};

/**
 * L'état realisee alimente le pipeline existant. Il ne le duplique pas.
 * Une carte déjà liée avance jusqu'à Estimation, jamais en arrière. Sans
 * carte, le bien estimé entre au pipeline directement dans Estimation.
 */
export async function syncLeadEtapeEstimation(params: {
  supabase: Db;
  agencyId: string;
  leadId: string | null;
  etat: EstimationEtat;
  /** Pour créer la carte quand l'estimation n'en a pas. */
  admin?: Db;
  profileId?: string;
  estimation?: EstimationAuPipeline;
}): Promise<void> {
  if (!poussePipelineEstimation(params.etat)) return;

  if (!params.leadId) {
    const e = params.estimation;
    if (!params.admin || !params.profileId || !e?.address) return;
    const r = await entrerDansLePipeline(
      params.admin,
      { agencyId: params.agencyId, profileId: params.profileId },
      {
        address: e.address,
        city: e.city,
        postalCode: e.postal_code,
        latitude: e.latitude,
        longitude: e.longitude,
        banId: e.ban_id,
        surfaceM2: e.surface_m2,
        rooms: e.rooms,
        etage: null,
        dpeClass: e.dpe_class,
        propertyType: e.property_type,
        ownerType: 'particulier',
        companyName: null,
        notes: 'Estimation réalisée',
        provenance: 'terrain',
        price: e.price_value,
        bienId: e.bien_id,
        etape: 'estimation',
      },
    );
    if ('erreur' in r) {
      console.error('[estimation] pipeline', r.erreur);
      return;
    }
    const lien: Database['public']['Tables']['agency_estimations']['Update'] = { lead_id: r.lead.id };
    if (!e.bien_id && r.lead.bien) lien.bien_id = r.lead.bien.id;
    await params.admin
      .from('agency_estimations')
      .update(lien)
      .eq('id', e.id)
      .eq('agency_id', params.agencyId)
      .is('lead_id', null);
    return;
  }

  const [{ data: stage }, { data: lead }] = await Promise.all([
    params.supabase
      .from('lead_stages')
      .select('id, ordre')
      .eq('agency_id', params.agencyId)
      .eq('cle', 'estimation')
      .maybeSingle(),
    params.supabase
      .from('leads')
      .select('stage_id')
      .eq('id', params.leadId)
      .eq('agency_id', params.agencyId)
      .maybeSingle(),
  ]);
  if (!stage || !lead) return;

  if (lead.stage_id) {
    const { data: actuelle } = await params.supabase
      .from('lead_stages')
      .select('ordre, type')
      .eq('id', lead.stage_id)
      .maybeSingle();
    if (actuelle && (actuelle.type === 'perdu' || actuelle.ordre >= stage.ordre)) return;
  }

  await params.supabase
    .from('leads')
    .update({ stage_id: stage.id, stage_changed_at: new Date().toISOString() })
    .eq('id', params.leadId)
    .eq('agency_id', params.agencyId);
}
