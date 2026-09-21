import type { SupabaseClient } from '@supabase/supabase-js';
import type { AgencyRapportPageRow, Database, EstimationRapportPageRow } from '@/types/database';
import { lignesDepuisModele } from '@/lib/rapport/composer';
import { slotsDepuisLignes } from '@/lib/rapport/modele-defaut';

type Session = SupabaseClient<Database>;

async function marquerCompose(session: Session, estimationId: string): Promise<void> {
  await session
    .from('agency_estimations')
    .update({ rapport_compose_at: new Date().toISOString() })
    .eq('id', estimationId);
}

/**
 * Premier chargement : recopie le modèle d'agence dans le rapport.
 * Un rapport vidé à la main n'est pas recouvert (rapport_compose_at).
 */
export async function appliquerModeleSiVide(
  session: Session,
  input: { estimationId: string; agencyId: string },
): Promise<EstimationRapportPageRow[]> {
  const { data: pages, error: pagesErr } = await session
    .from('estimation_rapport_pages')
    .select('*')
    .eq('estimation_id', input.estimationId)
    .eq('agency_id', input.agencyId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });

  if (pagesErr) throw new Error('Composition indisponible');
  if ((pages ?? []).length > 0) return pages ?? [];

  const { data: meta, error: metaErr } = await session
    .from('agency_estimations')
    .select('rapport_compose_at')
    .eq('id', input.estimationId)
    .maybeSingle();

  if (metaErr || meta?.rapport_compose_at) {
    return pages ?? [];
  }

  const { data: modeleRows, error: modeleErr } = await session
    .from('agency_rapport_modele')
    .select('source, bibliotheque_id, kind_generee')
    .eq('agency_id', input.agencyId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });

  if (modeleErr) {
    return [];
  }

  const slots = slotsDepuisLignes(modeleRows ?? []);
  const biblioIds = slots
    .filter((s): s is { source: 'bibliotheque'; bibliothequeId: string } => s.source === 'bibliotheque')
    .map((s) => s.bibliothequeId);

  let biblio: AgencyRapportPageRow[] = [];
  if (biblioIds.length > 0) {
    const { data: biblioRows } = await session.from('agency_rapport_pages').select('*').in('id', biblioIds);
    biblio = biblioRows ?? [];
  }

  const inserts = lignesDepuisModele({
    slots,
    biblio,
    estimationId: input.estimationId,
    agencyId: input.agencyId,
  });

  if (inserts.length === 0) {
    await marquerCompose(session, input.estimationId);
    return [];
  }

  const { data: inserted, error: insertErr } = await session
    .from('estimation_rapport_pages')
    .insert(inserts)
    .select('*');
  await marquerCompose(session, input.estimationId);
  if (insertErr) throw new Error('Composition indisponible');
  return (inserted ?? []).slice().sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at));
}
