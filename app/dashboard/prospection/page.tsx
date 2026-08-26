import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { fetchLeads, fetchTeamMembers } from '@/lib/queries/leads';
import { fetchLeadStages } from '@/lib/queries/lead-stages';
import { viewerFromProfile } from '@/lib/agency/visibility';
import { visibleLeadsFor } from '@/lib/agency/scope-records';
import { initializeLeadsLastSeenAt } from '@/lib/queries/profiles';
import {
  countLatestBatchLeads,
  shouldShowPipelineBanner,
} from '@/lib/lead-delivery';
import { parseProspectionVue } from '@/lib/prospection/vue';
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

  const params = await searchParams;
  if (params.vue === 'carte') {
    redirect('/dashboard/carte');
  }

  const supabase = await createSupabaseServerClient();
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

  const { lead: leadParam, filtre, vue: vueRaw } = params;
  const selectedLeadId = leadParam && visibleLeads.some((l) => l.id === leadParam) ? leadParam : null;
  const listFilter =
    filtre === 'sans-position' ||
    filtre === 'non-assignes-14j' ||
    filtre === 'non-pris' ||
    filtre === 'estimations'
      ? filtre
      : null;
  const vue = parseProspectionVue(vueRaw);

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
    />
  );
}
