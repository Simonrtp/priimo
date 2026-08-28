import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { fetchAgentOnboarding } from '@/lib/queries/agent-onboarding';
import { TOUTES_LES_ETAPES } from '@/lib/onboarding/parcours';
import type { AgentOnboardingInsert } from '@/types/database';

export const runtime = 'nodejs';

/**
 * Progression de la prise en main.
 *
 * L'état vit ici et non dans le navigateur : un agent qui ferme son portable
 * doit reprendre où il en était depuis son téléphone. Chaque appel enregistre
 * aussi le temps passé — sans mesure, on ne saura jamais à quelle étape les
 * agents décrochent.
 */

type Action =
  | { type: 'etape'; etape: string }
  | { type: 'passer_etape'; etape: string }
  | { type: 'terminer' }
  | { type: 'passer_tout' }
  | { type: 'refuser_relance' };

/** Une seule session ne peut pas ajouter plus que ça : borne anti-onglet oublié. */
const MAX_SECONDES_PAR_APPEL = 10 * 60;

function parseAction(raw: Record<string, unknown>): Action | null {
  const etape = typeof raw.etape === 'string' ? raw.etape : null;
  const valide = etape != null && (TOUTES_LES_ETAPES as readonly string[]).includes(etape);

  switch (raw.action) {
    case 'etape':
      return valide ? { type: 'etape', etape: etape! } : null;
    case 'passer_etape':
      return valide ? { type: 'passer_etape', etape: etape! } : null;
    case 'terminer':
      return { type: 'terminer' };
    case 'passer_tout':
      return { type: 'passer_tout' };
    case 'refuser_relance':
      return { type: 'refuser_relance' };
    default:
      return null;
  }
}

function ajouter(liste: readonly string[], valeur: string): string[] {
  return liste.includes(valeur) ? [...liste] : [...liste, valeur];
}

export async function GET() {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const supabase = await createSupabaseServerClient();
  return NextResponse.json({ onboarding: await fetchAgentOnboarding(supabase, profile.id) });
}

export async function POST(req: Request) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  let raw: Record<string, unknown>;
  try {
    raw = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }

  const action = parseAction(raw);
  if (!action) return NextResponse.json({ error: 'Action inconnue' }, { status: 400 });

  const secondes = Math.max(
    0,
    Math.min(MAX_SECONDES_PAR_APPEL, Math.round(Number(raw.secondes) || 0)),
  );

  const supabase = await createSupabaseServerClient();
  const existant = await fetchAgentOnboarding(supabase, profile.id);
  const now = new Date().toISOString();

  const patch: AgentOnboardingInsert = {
    profile_id: profile.id,
    agency_id: agency.id,
    last_seen_at: now,
    duration_seconds: (existant?.durationSeconds ?? 0) + secondes,
    steps_reached: existant?.stepsReached ?? [],
    steps_skipped: existant?.stepsSkipped ?? [],
    current_step: existant?.currentStep ?? null,
    completed_at: existant?.completedAt ?? null,
    skipped_at: existant?.skippedAt ?? null,
    relance_dismissed_at: existant?.relanceDismissedAt ?? null,
  };
  if (!existant?.startedAt) patch.started_at = now;

  switch (action.type) {
    case 'etape':
      patch.current_step = action.etape;
      patch.steps_reached = ajouter(patch.steps_reached ?? [], action.etape);
      break;
    case 'passer_etape':
      patch.steps_skipped = ajouter(patch.steps_skipped ?? [], action.etape);
      break;
    case 'terminer':
      patch.completed_at = now;
      break;
    case 'passer_tout':
      // « Passer » global : l'agent a répondu, on ne le relancera pas.
      patch.skipped_at = now;
      patch.relance_dismissed_at = now;
      break;
    case 'refuser_relance':
      patch.relance_dismissed_at = now;
      break;
  }

  const { error } = await supabase
    .from('agent_onboarding')
    .upsert(patch, { onConflict: 'profile_id' });

  if (error) {
    console.error('[onboarding] progression', error);
    return NextResponse.json({ error: 'Enregistrement impossible' }, { status: 500 });
  }

  return NextResponse.json({ onboarding: await fetchAgentOnboarding(supabase, profile.id) });
}
