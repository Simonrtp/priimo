import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { canSeeActivityOf, viewerFromProfile } from '@/lib/agency/visibility';
import { fetchMembersOfMyAgency } from '@/lib/queries/agency-members';
import { fetchLeadStages } from '@/lib/queries/lead-stages';
import { calculerPilotage } from '@/lib/activite/pilotage';
import { estPeriode } from '@/lib/activite/semaines';

export const runtime = 'nodejs';

/**
 * Le bilan d'une période, et rien d'autre.
 *
 * Changer de granularité passait par l'URL, donc par un rendu complet de
 * l'Accueil : une vingtaine de requêtes et le rapprochement de tous les biens,
 * trois secondes, pour mettre à jour cinq compteurs. Ici on ne lit que le
 * journal d'activité, les objectifs et les repères métier.
 */
export async function GET(req: Request) {
  const { user, profile, agency, memberships } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const url = new URL(req.url);
  const periodeBrute = url.searchParams.get('periode');
  if (!estPeriode(periodeBrute)) {
    return NextResponse.json({ error: 'Période inconnue' }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const viewer = viewerFromProfile(profile);
  const membreDemande = url.searchParams.get('membre');

  const [stages, members] = await Promise.all([
    fetchLeadStages(supabase),
    fetchMembersOfMyAgency(agency.id, memberships),
  ]);

  // Le sélecteur du directeur ne décide rien : l'autorisation se rejoue ici.
  const membreActivite =
    membreDemande && canSeeActivityOf(viewer, membreDemande) ? membreDemande : profile.id;

  const pilotage = await calculerPilotage({
    supabase,
    agencyId: agency.id,
    membreActivite,
    profileIdsAgence: members.map((m) => m.id),
    stages,
    periode: periodeBrute,
    ancre: url.searchParams.get('le'),
  });

  return NextResponse.json(pilotage);
}
