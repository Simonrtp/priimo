/**
 * Lecture et écriture de la boîte de réception d'actions.
 *
 * Deux règles tiennent ce fichier :
 *   — on n'écrase jamais une proposition existante. La clé de déduplication
 *     est la mémoire du système ; réécrire par-dessus ferait réapparaître ce
 *     que l'agent a déjà ignoré, et c'est le meilleur moyen de le faire
 *     décrocher.
 *   — une proposition ne se résout qu'une fois. La transition part toujours de
 *     `proposee`, en base, pas en mémoire : deux onglets ouverts ne doivent pas
 *     produire deux envois.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  AgencyActionInsert,
  AgencyActionKindDb,
  AgencyActionRow,
  AgencyActionStatutDb,
  Database,
} from '@/types/database';
import type { AgencyAction, AutomationKind, ProposedAction } from '@/lib/automations/types';

type Client = SupabaseClient<Database>;

const COLONNES =
  'id, agency_id, assigned_to, kind, dedup_key, titre, detail, payload, score, statut, expires_at, created_at, resolved_at, resolved_by';

function mapRow(row: AgencyActionRow): AgencyAction {
  return {
    id: row.id,
    kind: row.kind as AutomationKind,
    dedupKey: row.dedup_key,
    titre: row.titre,
    detail: row.detail,
    payload: (row.payload ?? {}) as Record<string, unknown>,
    score: row.score,
    assignedTo: row.assigned_to,
    expiresAt: row.expires_at,
    statut: row.statut,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  };
}

/* -------------------------------------------------------------------------- */
/* Écriture — réservée aux générateurs (clé service_role)                     */
/* -------------------------------------------------------------------------- */

/**
 * Dépose des propositions. Les doublons sont ignorés en base plutôt que
 * filtrés en amont : c'est la seule façon d'être juste quand deux passages du
 * cron se chevauchent.
 *
 * Rend le nombre de propositions réellement nouvelles.
 */
export async function deposerPropositions(
  admin: Client,
  agencyId: string,
  propositions: readonly ProposedAction[],
): Promise<number> {
  if (propositions.length === 0) return 0;

  const lignes: AgencyActionInsert[] = propositions.map((p) => ({
    agency_id: agencyId,
    assigned_to: p.assignedTo ?? null,
    kind: p.kind,
    dedup_key: p.dedupKey,
    titre: p.titre,
    detail: p.detail ?? null,
    payload: p.payload,
    score: p.score,
    statut: 'proposee',
    expires_at: p.expiresAt ?? null,
    resolved_at: null,
    resolved_by: null,
  }));

  const { data, error } = await admin
    .from('agency_actions')
    .upsert(lignes, { onConflict: 'agency_id,dedup_key', ignoreDuplicates: true })
    .select('id');

  if (error) {
    console.error('[actions] dépôt', agencyId, error.message);
    return 0;
  }
  return data?.length ?? 0;
}

/** Efface les propositions dont le signal est devenu froid. */
export async function expirerPropositions(admin: Client, now: Date = new Date()): Promise<number> {
  const { data, error } = await admin
    .from('agency_actions')
    .update({ statut: 'expiree', resolved_at: now.toISOString() })
    .eq('statut', 'proposee')
    .not('expires_at', 'is', null)
    .lt('expires_at', now.toISOString())
    .select('id');

  if (error) {
    console.error('[actions] expiration', error.message);
    return 0;
  }
  return data?.length ?? 0;
}

/* -------------------------------------------------------------------------- */
/* Lecture — côté agent                                                       */
/* -------------------------------------------------------------------------- */

export interface ListerActionsOptions {
  /** Directeur : toute l'agence. Collaborateur : les siennes et celles de personne. */
  profileId: string;
  estDirecteur: boolean;
  kinds?: readonly AutomationKind[];
  limit?: number;
}

export async function listerActionsOuvertes(
  supabase: Client,
  agencyId: string,
  options: ListerActionsOptions,
): Promise<AgencyAction[]> {
  let query = supabase
    .from('agency_actions')
    .select(COLONNES)
    .eq('agency_id', agencyId)
    .eq('statut', 'proposee')
    .order('score', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(options.limit ?? 50);

  if (options.kinds && options.kinds.length > 0) {
    query = query.in('kind', [...options.kinds] as AgencyActionKindDb[]);
  }

  // Un collaborateur voit ce qui lui est adressé et ce qui n'est adressé à
  // personne (le travail commun). Jamais la pile d'un collègue.
  if (!options.estDirecteur) {
    query = query.or(`assigned_to.eq.${options.profileId},assigned_to.is.null`);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[actions] lecture', agencyId, error.message);
    return [];
  }
  return (data ?? []).map((row) => mapRow(row as AgencyActionRow));
}

export async function compterActionsOuvertes(
  supabase: Client,
  agencyId: string,
  options: Pick<ListerActionsOptions, 'profileId' | 'estDirecteur'>,
): Promise<number> {
  let query = supabase
    .from('agency_actions')
    .select('id', { count: 'exact', head: true })
    .eq('agency_id', agencyId)
    .eq('statut', 'proposee');

  if (!options.estDirecteur) {
    query = query.or(`assigned_to.eq.${options.profileId},assigned_to.is.null`);
  }

  const { count, error } = await query;
  if (error) {
    console.error('[actions] comptage', agencyId, error.message);
    return 0;
  }
  return count ?? 0;
}

export async function lireAction(
  supabase: Client,
  actionId: string,
): Promise<AgencyAction | null> {
  const { data, error } = await supabase
    .from('agency_actions')
    .select(COLONNES)
    .eq('id', actionId)
    .maybeSingle();

  if (error || !data) return null;
  return mapRow(data as AgencyActionRow);
}

/* -------------------------------------------------------------------------- */
/* Résolution                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Passe une proposition à `validee` ou `ignoree`.
 *
 * Le filtre `statut = 'proposee'` est la garde de concurrence : deux clics
 * simultanés, une seule résolution, donc un seul envoi côté appelant. Rend
 * null si la proposition avait déjà été traitée.
 */
export async function resoudreAction(
  supabase: Client,
  actionId: string,
  statut: Extract<AgencyActionStatutDb, 'validee' | 'ignoree'>,
  profileId: string,
): Promise<AgencyAction | null> {
  const { data, error } = await supabase
    .from('agency_actions')
    .update({
      statut,
      resolved_at: new Date().toISOString(),
      resolved_by: profileId,
    })
    .eq('id', actionId)
    .eq('statut', 'proposee')
    .select(COLONNES)
    .maybeSingle();

  if (error) {
    console.error('[actions] résolution', actionId, error.message);
    return null;
  }
  return data ? mapRow(data as AgencyActionRow) : null;
}

/* -------------------------------------------------------------------------- */
/* Curseurs des veilles                                                       */
/* -------------------------------------------------------------------------- */

export async function lireCurseur(
  admin: Client,
  agencyId: string,
  automation: string,
): Promise<Record<string, unknown>> {
  const { data } = await admin
    .from('agency_automation_runs')
    .select('cursor')
    .eq('agency_id', agencyId)
    .eq('automation', automation)
    .maybeSingle();

  return (data?.cursor ?? {}) as Record<string, unknown>;
}

export async function ecrireCurseur(
  admin: Client,
  agencyId: string,
  automation: string,
  cursor: Record<string, unknown>,
  erreur: string | null = null,
): Promise<void> {
  const { error } = await admin.from('agency_automation_runs').upsert(
    {
      agency_id: agencyId,
      automation,
      last_run_at: new Date().toISOString(),
      cursor,
      last_error: erreur,
    },
    { onConflict: 'agency_id,automation' },
  );
  if (error) console.error('[actions] curseur', agencyId, automation, error.message);
}
