'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useUser } from '@/lib/hooks/useUser';
import DashboardTour from './DashboardTour';

/**
 * Orchestration de la visite guidée :
 * - auto  : premier login (profiles.onboarding_completed_at null) → au terme
 *   de la visite (ou si passée), on écrit la date pour ne plus la relancer ;
 * - manual: bouton « Revoir le guide » (TopBar) → ne touche jamais au flag.
 */

type TourMode = 'auto' | 'manual';

interface TourContextValue {
  startTour: () => void;
}

const TourContext = createContext<TourContextValue | null>(null);

export function useDashboardTour(): TourContextValue {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error('useDashboardTour must be used within DashboardTourProvider');
  return ctx;
}

function isProspectsPage(pathname: string): boolean {
  return pathname === '/dashboard' || pathname === '/dashboard/';
}

export default function DashboardTourProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useUser();
  const pathname = usePathname();
  const router = useRouter();
  const onProspects = isProspectsPage(pathname);

  const [mode, setMode] = useState<TourMode | null>(null);
  const [pendingManual, setPendingManual] = useState(false);
  const autoTriggered = useRef(false);

  // Premier login : lance la visite automatiquement sur la page prospects.
  useEffect(() => {
    if (!onProspects || autoTriggered.current || mode !== null) return;
    if (profile.onboarding_completed_at) return;
    autoTriggered.current = true;
    setMode('auto');
  }, [onProspects, profile.onboarding_completed_at, mode]);

  // Relance manuelle demandée depuis une autre page : attendre d'être revenu.
  useEffect(() => {
    if (pendingManual && onProspects) {
      setPendingManual(false);
      setMode('manual');
    }
  }, [pendingManual, onProspects]);

  const startTour = useCallback(() => {
    if (onProspects) {
      setMode('manual');
    } else {
      setPendingManual(true);
      router.push('/dashboard');
    }
  }, [onProspects, router]);

  const handleEnd = useCallback(() => {
    if (mode === 'auto') {
      // Fire-and-forget : un échec réseau relancera simplement le guide au prochain login.
      void fetch('/api/dashboard/onboarding-complete', { method: 'POST' }).catch(() => {});
    }
    setMode(null);
  }, [mode]);

  return (
    <TourContext.Provider value={{ startTour }}>
      {children}
      {mode !== null && onProspects && <DashboardTour key={mode} onEnd={handleEnd} />}
    </TourContext.Provider>
  );
}
