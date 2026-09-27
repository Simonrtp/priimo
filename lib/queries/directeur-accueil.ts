import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { DIRECTEUR_SEUILS } from '@/lib/directeur/config';
import { joursDepuis } from '@/lib/metier/mandat';

type Client = SupabaseClient<Database>;

export type EstimationRelanceRow = {
  id: string;
  createdBy: string | null;
  referentId: string | null;
  contactId: string | null;
  clientLabel: string;
  createdAt: string;
  lastViewedAt: string | null;
  viewCount: number;
  shareToken: string | null;
};

/**
 * Avis de valeur partagés (token présent), non révoqués — pour la règle
 * « estimation sans relance ». Une seule requête pour toute l'agence.
 */
export async function fetchEstimationsPourDirecteur(
  supabase: Client,
  agencyId: string,
): Promise<EstimationRelanceRow[]> {
  const since = new Date();
  since.setDate(since.getDate() - Math.max(DIRECTEUR_SEUILS.estimationSansRelanceJours * 3, 45));

  const { data, error } = await supabase
    .from('agency_estimations')
    .select(
      'id, created_by, referent_id, contact_id, created_at, last_viewed_at, view_count, share_token, address',
    )
    .eq('agency_id', agencyId)
    .not('share_token', 'is', null)
    .is('share_revoked_at', null)
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false })
    .limit(80);

  if (error) {
    console.error('[directeur] estimations', error.message);
    return [];
  }

  return (data ?? []).map((row) => {
    const address = (row.address as string | null)?.trim();
    return {
      id: row.id as string,
      createdBy: (row.created_by as string | null) ?? null,
      referentId: (row.referent_id as string | null) ?? null,
      contactId: (row.contact_id as string | null) ?? null,
      clientLabel: address ? `le bien ${address}` : 'le client',
      createdAt: row.created_at as string,
      lastViewedAt: (row.last_viewed_at as string | null) ?? null,
      viewCount: Number(row.view_count ?? 0),
      shareToken: (row.share_token as string | null) ?? null,
    };
  });
}

/** Dernière note / interaction après envoi — pour exclure les relances faites. */
export async function fetchDerniereActiviteParContact(
  supabase: Client,
  contactIds: readonly string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (contactIds.length === 0) return out;

  const { data: notes, error: notesErr } = await supabase
    .from('voice_notes')
    .select('contact_id, created_at')
    .in('contact_id', [...contactIds])
    .order('created_at', { ascending: false })
    .limit(200);
  if (notesErr) {
    console.error('[directeur] notes contact', notesErr.message);
  } else {
    for (const row of notes ?? []) {
      const cid = row.contact_id as string | null;
      const at = row.created_at as string;
      if (!cid || out.has(cid)) continue;
      out.set(cid, at);
    }
  }

  const { data: interactions, error: intErr } = await supabase
    .from('contact_interactions')
    .select('contact_id, occurred_at')
    .in('contact_id', [...contactIds])
    .order('occurred_at', { ascending: false })
    .limit(200);
  if (intErr) {
    // Table absente : on s'en tient aux notes.
    return out;
  }
  for (const row of interactions ?? []) {
    const cid = row.contact_id as string | null;
    const at = row.occurred_at as string;
    if (!cid) continue;
    const prev = out.get(cid);
    if (!prev || Date.parse(at) > Date.parse(prev)) out.set(cid, at);
  }
  return out;
}

export function joursDepuisIso(iso: string, now: Date): number {
  return joursDepuis(iso, now) ?? 0;
}
