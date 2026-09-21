'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import MobileAccountMenu from './MobileAccountMenu';
import { AssistantSearchBar } from '@/components/dashboard/assistant/AssistantSearchButton';
import ProfileAvatar from '@/components/dashboard/ProfileAvatar';
import ProspectsViewSwitch from '@/components/dashboard/ProspectsViewSwitch';
import { useUser } from '@/lib/hooks/useUser';
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
 * Bandeau terrain : photo de profil + barre de recherche.
 * Création (contact / bien / note) → onglet Plus en bas.
 */
export default function MobileChrome() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { profile } = useUser();
  const [accountOpen, setAccountOpen] = useState(false);

  if (hideShellHeader(pathname, searchParams)) return null;

  const surProspection = pathname.startsWith('/dashboard/prospection');
  const vueProspection = resoudreProspectionVue({
    vue: searchParams.get('vue'),
    lead: searchParams.get('lead'),
    filtre: searchParams.get('filtre'),
    fraicheur: searchParams.get('fraicheur'),
  });

  return (
    <>
      <div className="mobile-shell-header flex-shrink-0 bg-bg-base">
        <header
          className="relative z-[10] flex flex-col gap-2 pb-2"
          style={{
            paddingTop: 'calc(8px + env(safe-area-inset-top, 0px))',
            paddingLeft: 'var(--field-page-px)',
            paddingRight: 'var(--field-page-px)',
          }}
        >
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setAccountOpen(true)}
              aria-label="Compte et réglages"
              aria-expanded={accountOpen}
              aria-haspopup="dialog"
              className="app-press flex size-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-full"
            >
              <ProfileAvatar
                firstName={profile.first_name}
                lastName={profile.last_name}
                avatarUrl={profile.avatar_url}
                size={44}
              />
            </button>
            <div className="min-w-0 flex-1">
              <AssistantSearchBar />
            </div>
            {surProspection ? (
              <ProspectsViewSwitch
                variant="bar"
                value={vueProspection}
                onChange={(next) => {
                  router.replace(prospectionHref(new URLSearchParams(searchParams.toString()), next), {
                    scroll: false,
                  });
                }}
              />
            ) : null}
          </div>
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
