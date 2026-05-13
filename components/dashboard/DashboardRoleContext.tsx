'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';

export type DashboardRole = 'director' | 'agent';

type DashboardRoleContextValue = {
  role: DashboardRole;
  setRole: (r: DashboardRole) => void;
  isDirector: boolean;
};

const DashboardRoleContext = createContext<DashboardRoleContextValue | null>(null);

export function DashboardRoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<DashboardRole>('director');

  const setRole = useCallback((r: DashboardRole) => {
    setRoleState(r);
  }, []);

  const value = useMemo(
    () => ({
      role,
      setRole,
      isDirector: role === 'director',
    }),
    [role, setRole],
  );

  return <DashboardRoleContext.Provider value={value}>{children}</DashboardRoleContext.Provider>;
}

export function useDashboardRole(): DashboardRoleContextValue {
  const ctx = useContext(DashboardRoleContext);
  if (!ctx) {
    throw new Error('useDashboardRole must be used within DashboardRoleProvider');
  }
  return ctx;
}
