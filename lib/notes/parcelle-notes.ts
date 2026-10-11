import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { createSupabaseServerClient } from '@/lib/supabase/server';
import { bansDeLaParcelle } from '@/lib/notes/parcelle-depuis-ban';

type AgencyDb = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/**
 * Notes du volet parcelle : posées à l’adresse (BAN), liées à l’immeuble ou à
 * la parcelle, ou rattachées à un bien de l’agence sur cette parcelle. Les
 * identifiants seulement : la visibilité se tranche note par note ensuite.
 */
export async function notesPoseesSurLaParcelle(
  supabase: AgencyDb,
  agencyId: string,
  parcelleId: string,
): Promise<string[]> {
  const admin = createSupabaseAdminClient();
  const bans = await bansDeLaParcelle(admin, parcelleId);
  const ids = new Set<string>();

  const { data: liensParcelle } = await supabase
    .from('note_liens')
    .select('note_id')
    .eq('agency_id', agencyId)
    .eq('entite_type', 'parcelle')
    .eq('entite_id', parcelleId);
  for (const r of liensParcelle ?? []) ids.add((r as { note_id: string }).note_id);

  if (bans.length > 0) {
    const [{ data: parBan }, { data: liensImm }] = await Promise.all([
      supabase.from('voice_notes').select('id').eq('agency_id', agencyId).in('ban_id', bans),
      supabase
        .from('note_liens')
        .select('note_id')
        .eq('agency_id', agencyId)
        .eq('entite_type', 'immeuble')
        .in('entite_id', bans),
    ]);
    for (const r of parBan ?? []) ids.add((r as { id: string }).id);
    for (const r of liensImm ?? []) ids.add((r as { note_id: string }).note_id);

    // Biens de l’agence géocodés sur ces BAN → leurs notes aussi.
    const { data: biens } = await admin
      .from('biens')
      .select('id')
      .eq('agency_id', agencyId)
      .in('ban_id', bans);
    const bienIds = (biens ?? []).map((b) => (b as { id: string }).id);
    if (bienIds.length > 0) {
      const { data: liensBien } = await supabase
        .from('note_liens')
        .select('note_id')
        .eq('agency_id', agencyId)
        .eq('entite_type', 'bien')
        .in('entite_id', bienIds);
      for (const r of liensBien ?? []) ids.add((r as { note_id: string }).note_id);
    }
  }

  return [...ids];
}
