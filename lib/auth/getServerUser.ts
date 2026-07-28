import { cache } from 'react';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  buildAgencyMemberships,
  resolveActiveAgencyId,
  resolveActiveRole,
  type ProfileAgencyMembership,
} from '@/lib/auth/active-agency';
import type { AgencyRow, ContextualProfile, ProfileRow } from '@/types/database';

export interface ServerUser {
  user: { id: string; email: string } | null;
  profile: ContextualProfile | null;
  agency: AgencyRow | null;
  memberships: ProfileAgencyMembership[];
}

async function getServerUserUncached(): Promise<ServerUser> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, profile: null, agency: null, memberships: [] };

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, active_agency_id, first_name, last_name, phone, preferences, leads_last_seen_at, created_at, updated_at')
    .eq('id', user.id)
    .single();
  if (!profile) {
    return { user: { id: user.id, email: user.email ?? '' }, profile: null, agency: null, memberships: [] };
  }

  const { data: membershipRows } = await supabase
    .from('profile_agencies')
    .select('agency_id, role')
    .eq('profile_id', user.id);

  const rows = membershipRows ?? [];
  if (rows.length === 0) {
    return {
      user: { id: user.id, email: user.email ?? '' },
      profile: null,
      agency: null,
      memberships: [],
    };
  }

  const agencyIds = rows.map((r) => r.agency_id);
  const { data: agencies } = await supabase.from('agencies').select('*').in('id', agencyIds);
  const agencyList = agencies ?? [];

  const memberships = buildAgencyMemberships(rows, agencyList);
  const activeAgencyId = resolveActiveAgencyId(profile as ProfileRow, memberships);
  const activeRole = activeAgencyId ? resolveActiveRole(memberships, activeAgencyId) : null;

  if (!activeAgencyId || !activeRole) {
    return {
      user: { id: user.id, email: user.email ?? '' },
      profile: null,
      agency: null,
      memberships,
    };
  }

  const agency = agencyList.find((a) => a.id === activeAgencyId) ?? null;
  const contextualProfile: ContextualProfile = {
    ...(profile as ProfileRow),
    role: activeRole,
  };

  return {
    user: { id: user.id, email: user.email ?? '' },
    profile: contextualProfile,
    agency,
    memberships,
  };
}

/** Déduplique layout + page dans le même rendu RSC. */
export const getServerUser = cache(getServerUserUncached);
