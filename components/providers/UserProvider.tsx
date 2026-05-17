'use client';

import { useMemo } from 'react';
import { UserContext, type UserContextValue } from '@/lib/hooks/useUser';
import type { AgencyRow, ProfileRow } from '@/types/database';

interface UserProviderProps {
  user: { id: string; email: string };
  profile: ProfileRow;
  agency: AgencyRow;
  children: React.ReactNode;
}

export function UserProvider({ user, profile, agency, children }: UserProviderProps) {
  const value = useMemo<UserContextValue>(
    () => ({
      user,
      profile,
      agency,
      isDirector: profile.role === 'directeur',
      isCollaborator: profile.role === 'collaborateur',
    }),
    [user, profile, agency],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}
