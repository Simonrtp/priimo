/**
 * Les données réelles de la prise en main.
 *
 * Tout ce qui s'affiche appartient à l'agence de l'agent et passe par
 * lib/agency/visibility.ts. Aucune donnée de démonstration : si le secteur
 * n'a rien à montrer, l'étape concernée disparaît du parcours plutôt que de
 * présenter un écran vide.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { Lead } from '@/types/lead';

type Client = SupabaseClient<Database>;

export type OnboardingRow = {
  startedAt: string | null;
  lastSeenAt: string | null;
  currentStep: string | null;
  stepsReached: string[];
  stepsSkipped: string[];
  durationSeconds: number;
  completedAt: string | null;
  skippedAt: string | null;
  relanceDismissedAt: string | null;
};

export type OnboardingSecteur = {
  /** Adresses détectées par le moteur sur le secteur de l'agence. */
  adresses: number;
  /** Immeubles connus avec leur historique, sur les codes postaux de l'agence. */
  immeubles: number;
  codesPostaux: string[];
};

/** Un lead proposé à la prise, réduit à ce que l'étape affiche. */
export type OnboardingLeadPropose = {
  id: string;
  address: string;
  city: string | null;
  postalCode: string | null;
  score: number;
  mainSignalLabel: string | null;
  propertyType: string | null;
  surfaceM2: number | null;
};

export async function fetchAgentOnboarding(
  supabase: Client,
  profileId: string,
): Promise<OnboardingRow | null> {
  const { data, error } = await supabase
    .from('agent_onboarding')
    .select(
      'started_at, last_seen_at, current_step, steps_reached, steps_skipped, duration_seconds, completed_at, skipped_at, relance_dismissed_at',
    )
    .eq('profile_id', profileId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    startedAt: data.started_at,
    lastSeenAt: data.last_seen_at,
    currentStep: data.current_step,
    stepsReached: data.steps_reached ?? [],
    stepsSkipped: data.steps_skipped ?? [],
    durationSeconds: data.duration_seconds ?? 0,
    completedAt: data.completed_at,
    skippedAt: data.skipped_at,
    relanceDismissedAt: data.relance_dismissed_at,
  };
}

/**
 * Les chiffres du secteur, lus en base pour CETTE agence.
 *
 * C'est la première phrase que lit l'agent : elle doit être vraie, sinon tout
 * le reste du parcours perd sa crédibilité.
 */
export async function fetchOnboardingSecteur(
  supabase: Client,
  agencyId: string,
  codesPostaux: readonly string[],
): Promise<OnboardingSecteur> {
  const codes = [...codesPostaux].filter(Boolean);

  const [leadsRes, immeublesRes] = await Promise.all([
    supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('agency_id', agencyId),
    codes.length > 0
      ? supabase
          .from('buildings')
          .select('id', { count: 'exact', head: true })
          .in('code_postal', codes)
      : Promise.resolve({ count: 0 }),
  ]);

  return {
    adresses: leadsRes.count ?? 0,
    immeubles: ('count' in immeublesRes ? immeublesRes.count : 0) ?? 0,
    codesPostaux: codes,
  };
}

/**
 * Les trois adresses les mieux notées que personne n'a prises.
 *
 * Non assignées et hors pipeline : prendre un lead déjà pris par un collègue
 * n'apprendrait rien et créerait un conflit dès la première minute.
 */
export function troisLeadsAPrendre(leads: readonly Lead[]): OnboardingLeadPropose[] {
  return leads
    .filter((lead) => lead.assignedTo == null && lead.stageId == null)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((lead) => ({
      id: lead.id,
      address: lead.address,
      city: lead.city,
      postalCode: lead.postalCode,
      score: lead.score,
      mainSignalLabel: lead.mainSignalLabel,
      propertyType: lead.propertyType,
      surfaceM2: lead.surfaceM2,
    }));
}

/**
 * Le secteur a-t-il des parcelles exploitables ?
 * Sans historique public, l'étape « ouvrez un immeuble » n'a rien à ouvrir.
 */
export async function secteurADesParcelles(
  supabase: Client,
  codesPostaux: readonly string[],
): Promise<boolean> {
  const codes = [...codesPostaux].filter(Boolean);
  if (codes.length === 0) return false;

  const { count } = await supabase
    .from('building_transactions')
    .select('id', { count: 'exact', head: true })
    .in('code_postal', codes)
    .not('parcelle_id', 'is', null)
    .limit(1);

  return (count ?? 0) > 0;
}
