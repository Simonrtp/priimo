import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { markOnboardingCompleted } from '@/lib/queries/profiles';

/** Fin (ou passage) de la visite guidée : écrit onboarding_completed_at. */
export async function POST() {
  const { user, profile } = await getServerUser();
  if (!user || !profile) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const supabase = await createSupabaseServerClient();
  try {
    const onboardingCompletedAt = await markOnboardingCompleted(supabase, profile.id);
    return NextResponse.json({ onboardingCompletedAt });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erreur serveur';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
