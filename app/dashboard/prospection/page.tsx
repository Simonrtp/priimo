import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { fetchLeads, fetchTeamMembers } from '@/lib/queries/leads';
import { fetchLeadStages } from '@/lib/queries/lead-stages';
import { fetchContactsSafe, fetchVoiceNotesSafe } from '@/lib/queries/contacts';
import { fetchBiensSafe } from '@/lib/queries/biens';
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
import { buildSectorMapPoints } from '@/lib/carte/points';
import { parseProspectionVue } from '@/components/dashboard/ProspectsViewSwitch';
import ProspectsClient from '@/components/dashboard/ProspectsClient';

export const metadata = {
  title: 'Prospection',
};

export default async function ProspectionPage({
  searchParams,
}: {
  searchParams: Promise<{ lead?: string; filtre?: string; vue?: string }>;
}) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) redirect('/login');

  const supabase = await createSupabaseServerClient();
  const [leads, teamMembers, stages, contacts, biens, notes] = await Promise.all([
    fetchLeads(supabase),
    fetchTeamMembers(supabase, agency.id),
    fetchLeadStages(supabase),
    fetchContactsSafe(supabase),
    fetchBiensSafe(supabase),
    fetchVoiceNotesSafe(supabase),
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

  const { lead: leadParam, filtre, vue: vueRaw } = await searchParams;
  const selectedLeadId = leadParam && visibleLeads.some((l) => l.id === leadParam) ? leadParam : null;
  const listFilter =
    filtre === 'sans-position' || filtre === 'non-assignes-14j' ? filtre : null;
  const vue = parseProspectionVue(vueRaw);

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
      initialVue={vue}
      mapData={{
        points,
        withoutPosition,
        unplaced,
        agencyPostalCodes: agency.codes_postaux ?? [],
        center: { latitude: agency.latitude, longitude: agency.longitude },
      }}
    />
  );
}
