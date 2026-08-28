import { createSupabaseServerClient } from '@/lib/supabase/server';
import { fetchMembersOfMyAgency, type AgencyMember } from '@/lib/queries/agency-members';
import type { ProfileAgencyMembership } from '@/lib/auth/active-agency';
import { etatOnboarding, type EtatOnboarding } from '@/lib/onboarding/parcours';

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
  /**
   * Prise en main par membre. C'est le premier signal d'adoption dont dispose
   * le directeur, et il arrive bien avant les chiffres de production.
   */
  onboardingByMemberId: Record<string, EtatOnboarding>;
};

export async function fetchTeamSettingsData(
  agencyId: string,
  memberships: ProfileAgencyMembership[],
  userId: string,
): Promise<TeamSettingsData> {
  const supabase = await createSupabaseServerClient();
  const [members, invitesRes, onboardingRes] = await Promise.all([
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
    supabase
      .from('agent_onboarding')
      .select('profile_id, started_at, completed_at, skipped_at')
      .eq('agency_id', agencyId),
  ]);

  const onboardingByMemberId: Record<string, EtatOnboarding> = {};
  for (const member of members) {
    onboardingByMemberId[member.id] = 'jamais_ouvert';
  }
  for (const row of onboardingRes.data ?? []) {
    const id = row.profile_id as string;
    if (!(id in onboardingByMemberId)) continue;
    onboardingByMemberId[id] = etatOnboarding({
      startedAt: row.started_at as string | null,
      completedAt: row.completed_at as string | null,
      skippedAt: row.skipped_at as string | null,
    });
  }

  return {
    currentUserId: userId,
    members,
    invitations: (invitesRes.data ?? []) as TeamInvitationRow[],
    onboardingByMemberId,
  };
}
