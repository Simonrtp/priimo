import { cache } from 'react';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { timed } from '@/lib/perf/timing';
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

const AGENCIES_SELECT =
  'id, name, address, phone, email, plan, codes_postaux, latitude, longitude, stripe_customer_id, created_at, updated_at';

async function getServerUserUncached(): Promise<ServerUser> {
  return timed('getServerUser', async () => {
  const supabase = await timed('createSupabaseServerClient', () => createSupabaseServerClient());
  const {
    data: { user },
  } = await timed('auth.getUser', () => supabase.auth.getUser());
  if (!user) return { user: null, profile: null, agency: null, memberships: [] };

  const [profileRes, membershipRes] = await Promise.all([
    timed('profiles.select', async () =>
      supabase
        .from('profiles')
        .select(
          'id, active_agency_id, first_name, last_name, phone, preferences, leads_last_seen_at, onboarding_completed_at, created_at, updated_at',
        )
        .eq('id', user.id)
        .single(),
    ),
    timed('profile_agencies.select', async () =>
      supabase.from('profile_agencies').select('agency_id, role').eq('profile_id', user.id),
    ),
  ]);

  const profile = profileRes.data;
  if (!profile) {
    return { user: { id: user.id, email: user.email ?? '' }, profile: null, agency: null, memberships: [] };
  }

  const rows = membershipRes.data ?? [];
  if (rows.length === 0) {
    return {
      user: { id: user.id, email: user.email ?? '' },
      profile: null,
      agency: null,
      memberships: [],
    };
  }

  const agencyIds = rows.map((r) => r.agency_id);
  const { data: agencies } = await timed('agencies.select', async () =>
    supabase.from('agencies').select(AGENCIES_SELECT).in('id', agencyIds),
  );
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
  });
}

/** Déduplique layout + page dans le même rendu RSC. */
export const getServerUser = cache(getServerUserUncached);
