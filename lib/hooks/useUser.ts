'use client';

import { createContext, useContext } from 'react';
import type { AgencyRow, ProfileRow } from '@/types/database';

export interface UserContextValue {
  user: { id: string; email: string };
  profile: ProfileRow;
  agency: AgencyRow;
  isDirector: boolean;
  isCollaborator: boolean;
}

export const UserContext = createContext<UserContextValue | null>(null);

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) {
    throw new Error('useUser must be used within UserProvider');
  }
  return ctx;
}
