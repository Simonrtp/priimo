'use client';

import { useMemo } from 'react';
import { UserContext, type UserContextValue } from '@/lib/hooks/useUser';
import type { AgencyRow, ProfileRow } from '@/types/database';
import type { ProfileAgencyMembership } from '@/lib/auth/active-agency';

interface UserProviderProps {
  user: { id: string; email: string };
  profile: ProfileRow;
  agency: AgencyRow;
  memberships: ProfileAgencyMembership[];
  children: React.ReactNode;
}

export function UserProvider({ user, profile, agency, memberships, children }: UserProviderProps) {
  const value = useMemo<UserContextValue>(
    () => ({
      user,
      profile,
      agency,
      memberships,
      isDirector: profile.role === 'directeur',
      isCollaborator: profile.role === 'collaborateur',
      hasMultipleAgencies: memberships.length > 1,
    }),
    [user, profile, agency, memberships],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}
