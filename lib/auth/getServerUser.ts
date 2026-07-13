import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  buildAgencyMemberships,
  resolveActiveAgencyId,
  resolveActiveRole,
  type ProfileAgencyMembership,
} from '@/lib/auth/active-agency';
import type { AgencyRow, ProfileRow } from '@/types/database';

export interface ServerUser {
  user: { id: string; email: string } | null;
  profile: ProfileRow | null;
  agency: AgencyRow | null;
  memberships: ProfileAgencyMembership[];
}

export async function getServerUser(): Promise<ServerUser> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, profile: null, agency: null, memberships: [] };

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  if (!profile) {
    return { user: { id: user.id, email: user.email ?? '' }, profile: null, agency: null, memberships: [] };
  }

  const { data: membershipRows } = await supabase
    .from('profile_agencies')
    .select('agency_id, role')
    .eq('profile_id', user.id);

  const rows = membershipRows ?? [];
  const fallbackRows =
    rows.length > 0
      ? rows
      : [{ agency_id: profile.agency_id, role: profile.role as ProfileRow['role'] }];

  const { data: agencies } = await supabase.from('agencies').select('*');
  const agencyList = agencies ?? [];

  const memberships = buildAgencyMemberships(fallbackRows, agencyList);
  const activeAgencyId = resolveActiveAgencyId(profile, memberships);
  const activeRole = resolveActiveRole(profile, memberships, activeAgencyId);
  const agency = agencyList.find((a) => a.id === activeAgencyId) ?? null;

  const contextualProfile: ProfileRow = {
    ...profile,
    role: activeRole,
  };

  return {
    user: { id: user.id, email: user.email ?? '' },
    profile: contextualProfile,
    agency,
    memberships,
  };
}
