import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { canSeeOwnedRecord, viewerFromProfile } from '@/lib/agency/visibility';
import { ESTIMATION_SELECT, mapEstimation, type EstimationObjet } from '@/lib/estimation/objet';
import { refuserSiEstimationFermee } from '@/lib/billing/exiger';
import type { AgencyRow, ContextualProfile } from '@/types/database';

export type SessionRapport = {
  user: { id: string; email: string };
  profile: ContextualProfile;
  agency: AgencyRow;
  estimation: EstimationObjet;
};

export async function sessionRapportEstimation(
  estimationId: string,
): Promise<SessionRapport | NextResponse> {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }
  const ferme = refuserSiEstimationFermee(agency);
  if (ferme) return ferme;
  if (!estimationId) {
    return NextResponse.json({ error: 'Identifiant manquant' }, { status: 400 });
  }

  const session = await createSupabaseServerClient();
  const { data, error } = await session
    .from('agency_estimations')
    .select(ESTIMATION_SELECT)
    .eq('id', estimationId)
    .eq('agency_id', agency.id)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: 'Estimation introuvable' }, { status: 404 });
  }

  const viewer = viewerFromProfile(profile);
  if (
    !canSeeOwnedRecord(viewer, {
      assignedTo: data.referent_id,
      createdBy: data.created_by,
    })
  ) {
    return NextResponse.json({ error: 'Estimation introuvable' }, { status: 404 });
  }

  return {
    user,
    profile,
    agency,
    estimation: mapEstimation(data),
  };
}

export function estNextResponse(value: SessionRapport | NextResponse): value is NextResponse {
  return value instanceof NextResponse;
}
