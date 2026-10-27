'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import MobileAccountMenu from './MobileAccountMenu';
import MobileSearchCapsule from './MobileSearchCapsule';
import ProspectsViewSwitch from '@/components/dashboard/ProspectsViewSwitch';
import {
  useEmplacementAffiche,
  useEmplacementDeLaPage,
  useNavigationInstantanee,
} from '@/components/dashboard/navigation/NavigationInstantanee';
import { vueProspection as vueDemandee } from '@/lib/navigation/cible';
import { prospectionHref, resoudreProspectionVue } from '@/lib/prospection/vue';

/** Pages sans bandeau bleu (carte plein écran, tournée guidée). */
function hideShellHeader(pathname: string, search: URLSearchParams): boolean {
  if (pathname.startsWith('/dashboard/tournee') || pathname.startsWith('/dashboard/carte')) {
    return true;
  }
  if (!pathname.startsWith('/dashboard/prospection')) return false;
  return (
    resoudreProspectionVue({
      vue: search.get('vue'),
      lead: search.get('lead'),
      filtre: search.get('filtre'),
      fraicheur: search.get('fraicheur'),
    }) === 'carte'
  );
}

/**
 * Bandeau terrain : même capsule de recherche que la carte, photo de profil à droite.
 * Création (contact / bien / note) → onglet Plus en bas.
 */
export default function MobileChrome() {
  // Le bandeau suit l'écran affiché (squelette compris) ; l'onglet suit le clic.
  const page = useEmplacementDeLaPage();
  const demande = useEmplacementAffiche();
  const { naviguer } = useNavigationInstantanee();
  const pathname = page.pathname;
  const searchParams = new URLSearchParams(page.search);
  const [accountOpen, setAccountOpen] = useState(false);

  if (hideShellHeader(pathname, searchParams)) return null;

  const surProspection = pathname.startsWith('/dashboard/prospection');
  const surAccueil = pathname === '/dashboard' || pathname === '/dashboard/';
  // Vers un autre écran, l'onglet reste où il est.
  const vueProspection = vueDemandee(demande) ?? vueDemandee(page) ?? 'carte';

  return (
    <>
      <div
        className={`mobile-shell-header ${
          surAccueil
            ? 'mobile-shell-header--overlay pointer-events-none'
            : 'flex-shrink-0 bg-bg-base'
        }`}
      >
        <header
          className={`relative z-[10] flex flex-col gap-2 pb-2 ${
            surAccueil ? 'pointer-events-none' : ''
          }`}
          style={{
            paddingTop: 'calc(8px + env(safe-area-inset-top, 0px))',
            paddingLeft: 'var(--field-page-px)',
            paddingRight: 'var(--field-page-px)',
          }}
        >
          <div className={surAccueil ? 'pointer-events-auto' : undefined}>
            <MobileSearchCapsule
              onAccount={() => setAccountOpen(true)}
              accountOpen={accountOpen}
            />
          </div>
          {surProspection ? (
            <div className="flex justify-end">
              <ProspectsViewSwitch
                variant="bar"
                value={vueProspection}
                onChange={(next) => {
                  naviguer(prospectionHref(new URLSearchParams(demande.search), next), { remplacer: true });
                }}
              />
            </div>
          ) : null}
        </header>
      </div>
      <MobileAccountMenu open={accountOpen} onClose={() => setAccountOpen(false)} />
    </>
  );
}

export function MobileBackSwipe() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  if (hideShellHeader(pathname, searchParams)) return null;

  return (
    <div
      className="mobile-back-swipe fixed inset-y-0 left-0 z-[40] w-5"
      onTouchStart={(e) => {
        const startX = e.changedTouches[0]?.clientX ?? 0;
        const startY = e.changedTouches[0]?.clientY ?? 0;
        function onEnd(ev: TouchEvent) {
          const t = ev.changedTouches[0];
          document.removeEventListener('touchend', onEnd);
          if (!t) return;
          const dx = t.clientX - startX;
          const dy = Math.abs(t.clientY - startY);
          if (dx > 72 && dy < 80) router.back();
        }
        document.addEventListener('touchend', onEnd, { once: true });
      }}
      aria-hidden
    />
  );
}
