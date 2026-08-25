import { createSupabaseServerClient } from '@/lib/supabase/server';
import { fetchMembersOfMyAgency, type AgencyMember } from '@/lib/queries/agency-members';
import type { ProfileAgencyMembership } from '@/lib/auth/active-agency';

export type TeamInvitationRow = {
  id: string;
  email: string;
  created_at: string;
  expires_at: string;
};

export type TeamSettingsData = {
  currentUserId: string;
  members: AgencyMember[];
  invitations: TeamInvitationRow[];
};

export async function fetchTeamSettingsData(
  agencyId: string,
  memberships: ProfileAgencyMembership[],
  userId: string,
): Promise<TeamSettingsData> {
  const supabase = await createSupabaseServerClient();
  const [members, invitesRes] = await Promise.all([
    fetchMembersOfMyAgency(agencyId, memberships, {
      includeEmail: true,
      includeStats: true,
    }),
    supabase
      .from('invitations')
      .select('id, email, role, agency_id, created_at, expires_at, used_at')
      .eq('agency_id', agencyId)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false }),
  ]);

  return {
    currentUserId: userId,
    members,
    invitations: (invitesRes.data ?? []) as TeamInvitationRow[],
  };
}
