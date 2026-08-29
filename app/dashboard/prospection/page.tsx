import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { fetchLeads, fetchTeamMembers } from '@/lib/queries/leads';
import { fetchLeadStages } from '@/lib/queries/lead-stages';
import { viewerFromProfile } from '@/lib/agency/visibility';
import {
  visibleBiensFor,
  visibleContactsFor,
  visibleLeadsFor,
  visibleVoiceNotesFor,
} from '@/lib/agency/scope-records';
import { initializeLeadsLastSeenAt } from '@/lib/queries/profiles';
import {
  countLatestBatchLeads,
  shouldShowPipelineBanner,
} from '@/lib/lead-delivery';
import { parseProspectionVue } from '@/lib/prospection/vue';
import { fetchContactsSafe, fetchVoiceNotesSafe } from '@/lib/queries/contacts';
import { fetchBiensSafe } from '@/lib/queries/biens';
import { fetchMembersOfMyAgency } from '@/lib/queries/agency-members';
import { buildSectorMapPoints } from '@/lib/carte/points';
import { buildSortie } from '@/lib/today/sortie';
import { toItineraireStops } from '@/lib/today/directions';
import ProspectsClient from '@/components/dashboard/ProspectsClient';
import ProspectionCarteView from '@/components/dashboard/ProspectionCarteView';

export const metadata = {
  title: 'Prospection',
};

export default async function ProspectionPage({
  searchParams,
}: {
  searchParams: Promise<{
    lead?: string;
    filtre?: string;
    vue?: string;
    membre?: string;
    immeuble?: string;
    itineraire?: string;
    tournee?: string;
  }>;
}) {
  const { user, profile, agency, memberships } = await getServerUser();
  if (!user || !profile || !agency) redirect('/login');

  const params = await searchParams;
  const vueRaw = params.vue;
  const listFilter =
    params.filtre === 'sans-position' ||
    params.filtre === 'non-assignes-14j' ||
    params.filtre === 'non-pris' ||
    params.filtre === 'estimations'
      ? params.filtre
      : null;
  const vue =
    listFilter === 'non-pris' || listFilter === 'estimations'
      ? 'liste'
      : parseProspectionVue(vueRaw);

  const supabase = await createSupabaseServerClient();

  if (vue === 'carte') {
    const viewer = viewerFromProfile(profile);
    const [leads, contacts, biens, notes, members] = await Promise.all([
      fetchLeads(supabase),
      fetchContactsSafe(supabase),
      fetchBiensSafe(supabase),
      fetchVoiceNotesSafe(supabase),
      fetchMembersOfMyAgency(agency.id, memberships),
    ]);
    const visibleLeads = visibleLeadsFor(viewer, leads);
    const { points, withoutPosition, unplaced } = buildSectorMapPoints({
      agencyId: agency.id,
      leads: visibleLeads,
      contacts: visibleContactsFor(viewer, contacts).map((c) => ({
        ...c,
        postalCodes: c.criteria.postalCodes,
      })),
      biens: visibleBiensFor(viewer, biens),
      notes: visibleVoiceNotesFor(viewer, notes),
    });
    const membersUi = members.map((m) => ({ id: m.id, fullName: m.fullName }));
    const plan = params.itineraire === '1' ? buildSortie(visibleLeads, profile.id, null) : null;
    const itineraryStops = plan ? toItineraireStops(plan.ordered) : null;

    return (
      <ProspectionCarteView
        points={points}
        withoutPosition={withoutPosition}
        unplaced={unplaced}
        agencyPostalCodes={agency.codes_postaux ?? []}
        center={{ latitude: agency.latitude, longitude: agency.longitude }}
        members={membersUi}
        isDirector={profile.role === 'directeur'}
        initialLeads={visibleLeads}
        profileId={profile.id}
        agencyOrigin={
          agency.latitude != null && agency.longitude != null
            ? { latitude: agency.latitude, longitude: agency.longitude }
            : null
        }
        initialBanId={params.immeuble ?? null}
        itineraryStops={itineraryStops}
        showItineraire={params.itineraire === '1'}
        autoTournee={params.tournee === '1' && profile.role !== 'directeur'}
      />
    );
  }

  const [leads, teamMembers, stages] = await Promise.all([
    fetchLeads(supabase),
    fetchTeamMembers(supabase, agency.id),
    fetchLeadStages(supabase),
  ]);
  const viewer = viewerFromProfile(profile);
  const visibleLeads = visibleLeadsFor(viewer, leads);

  const storedLastSeen = profile.leads_last_seen_at ?? null;
  let showPipelineBanner = false;

  if (storedLastSeen === null) {
    await initializeLeadsLastSeenAt(supabase, profile.id);
  } else {
    showPipelineBanner = shouldShowPipelineBanner(visibleLeads, storedLastSeen);
  }

  const newBatchCount = countLatestBatchLeads(visibleLeads);
  const selectedLeadId =
    params.lead && visibleLeads.some((l) => l.id === params.lead) ? params.lead : null;

  return (
    <ProspectsClient
      initialLeads={visibleLeads}
      teamMembers={teamMembers}
      stages={stages}
      isDirector={profile.role === 'directeur'}
      initialShowPipelineBanner={showPipelineBanner}
      initialNewBatchCount={newBatchCount}
      initialSelectedLeadId={selectedLeadId}
      listFilter={listFilter}
      memberId={params.membre ?? null}
      initialVue={vue}
    />
  );
}
