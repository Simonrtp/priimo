import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { fetchLeads, fetchTeamMembers } from '@/lib/queries/leads';
import ProspectsClient from '@/components/dashboard/ProspectsClient';

export default async function DashboardPage() {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) redirect('/login');

  const supabase = await createSupabaseServerClient();
  const [leads, teamMembers] = await Promise.all([
    fetchLeads(supabase),
    fetchTeamMembers(supabase, agency.id),
  ]);

  return (
    <ProspectsClient
      initialLeads={leads}
      teamMembers={teamMembers}
      isDirector={profile.role === 'directeur'}
      agencyZone={
        agency.zone_latitude != null && agency.zone_longitude != null
          ? {
              latitude: agency.zone_latitude,
              longitude: agency.zone_longitude,
              radiusKm: agency.zone_radius_km,
            }
          : null
      }
    />
  );
}
