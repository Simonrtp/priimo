'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useUser } from '@/lib/hooks/useUser';
import ClayButton from '@/components/ui/ClayButton';
import DashboardTour from './DashboardTour';

/**
 * Orchestration de la visite guidée :
 * - auto  : première connexion avec des leads
 *   (profiles.onboarding_completed_at null) → la date est écrite dès le
 *   déclenchement : jamais relancée automatiquement (ni refresh, ni relogin) ;
 * - sans leads : message d'accueil une fois (session), flag NON écrit ;
 * - manual: bouton « Revoir le guide » (TopBar) → ne touche jamais au flag.
 */

const EMPTY_WELCOME_KEY = 'priimo-empty-leads-welcome';

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

function hasLeadCardsInDom(): boolean {
  return Boolean(document.querySelector('[data-tour="lead-card"]'));
}

function EmptyLeadsWelcome({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center px-4"
      style={{ backgroundColor: 'rgba(21, 32, 47, 0.38)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="empty-leads-welcome-title"
    >
      <div className="w-[min(360px,calc(100vw-32px))] rounded-clay-lg bg-surface p-5 shadow-clay-lg">
        <p
          id="empty-leads-welcome-title"
          className="text-pretty leading-relaxed text-text"
          style={{ fontSize: 14 }}
        >
          Votre première liste arrive lundi. Vous recevrez un email dès qu&apos;elle est disponible,
          et une visite guidée vous attendra ici.
        </p>
        <div className="mt-4 flex justify-end">
          <ClayButton
            type="button"
            variant="primary"
            className="!px-4 !py-2 text-[13px]"
            onClick={onClose}
          >
            Compris
          </ClayButton>
        </div>
      </div>
    </div>
  );
}

export default function DashboardTourProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useUser();
  const pathname = usePathname();
  const router = useRouter();
  const onProspects = isProspectsPage(pathname);

  const [mode, setMode] = useState<TourMode | null>(null);
  const [pendingManual, setPendingManual] = useState(false);
  const [showEmptyWelcome, setShowEmptyWelcome] = useState(false);
  const autoTriggered = useRef(false);

  // Première connexion : lance la visite seulement s'il y a des leads.
  // Sans leads : message d'accueil une fois (session), sans écrire le flag.
  useEffect(() => {
    if (!onProspects || autoTriggered.current || mode !== null) return;
    if (profile.onboarding_completed_at) return;

    const t = window.setTimeout(() => {
      if (!hasLeadCardsInDom()) {
        try {
          if (!sessionStorage.getItem(EMPTY_WELCOME_KEY)) {
            sessionStorage.setItem(EMPTY_WELCOME_KEY, '1');
            setShowEmptyWelcome(true);
          }
        } catch {
          setShowEmptyWelcome(true);
        }
        return;
      }

      autoTriggered.current = true;
      setMode('auto');
      void fetch('/api/dashboard/onboarding-complete', { method: 'POST' }).catch(() => {
        // Échec réseau : le guide se relancera au prochain chargement, sans gravité.
      });
    }, 600);

    return () => window.clearTimeout(t);
  }, [onProspects, profile.onboarding_completed_at, mode]);

  // Relance manuelle demandée depuis une autre page : attendre d'être revenu.
  useEffect(() => {
    if (pendingManual && onProspects) {
      setPendingManual(false);
      if (!hasLeadCardsInDom()) {
        setShowEmptyWelcome(true);
        return;
      }
      setMode('manual');
    }
  }, [pendingManual, onProspects]);

  const startTour = useCallback(() => {
    if (onProspects) {
      if (!hasLeadCardsInDom()) {
        setShowEmptyWelcome(true);
        return;
      }
      setMode('manual');
    } else {
      setPendingManual(true);
      router.push('/dashboard');
    }
  }, [onProspects, router]);

  const handleEnd = useCallback(() => {
    setMode(null);
  }, []);

  return (
    <TourContext.Provider value={{ startTour }}>
      {children}
      {mode !== null && onProspects && <DashboardTour key={mode} onEnd={handleEnd} />}
      {showEmptyWelcome && <EmptyLeadsWelcome onClose={() => setShowEmptyWelcome(false)} />}
    </TourContext.Provider>
  );
}
