'use client';

import { createContext, useContext } from 'react';
import type { AgencyRow, ContextualProfile } from '@/types/database';
import type { ProfileAgencyMembership } from '@/lib/auth/active-agency';

export interface UserContextValue {
  user: { id: string; email: string };
  profile: ContextualProfile;
  agency: AgencyRow;
  memberships: ProfileAgencyMembership[];
  isDirector: boolean;
  isCollaborator: boolean;
  hasMultipleAgencies: boolean;
}

export const UserContext = createContext<UserContextValue | null>(null);

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) {
    throw new Error('useUser must be used within UserProvider');
  }
  return ctx;
}
