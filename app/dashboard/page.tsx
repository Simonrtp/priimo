import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { fetchLeads, fetchTeamMembers } from '@/lib/queries/leads';
import { initializeLeadsLastSeenAt } from '@/lib/queries/profiles';
import {
  countLatestBatchLeads,
  shouldShowPipelineBanner,
} from '@/lib/lead-delivery';
import ProspectsClient from '@/components/dashboard/ProspectsClient';

export default async function DashboardPage() {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) redirect('/login');

  const supabase = await createSupabaseServerClient();
  const [leads, teamMembers] = await Promise.all([
    fetchLeads(supabase),
    fetchTeamMembers(supabase, agency.id),
  ]);

  const storedLastSeen = profile.leads_last_seen_at ?? null;
  let showPipelineBanner = false;

  if (storedLastSeen === null) {
    await initializeLeadsLastSeenAt(supabase, profile.id);
  } else {
    showPipelineBanner = shouldShowPipelineBanner(leads, storedLastSeen);
  }

  const newBatchCount = countLatestBatchLeads(leads);

  return (
    <ProspectsClient
      initialLeads={leads}
      teamMembers={teamMembers}
      isDirector={profile.role === 'directeur'}
      initialShowPipelineBanner={showPipelineBanner}
      initialNewBatchCount={newBatchCount}
    />
  );
}
