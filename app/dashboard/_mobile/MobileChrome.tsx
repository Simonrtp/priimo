'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Search, X } from 'lucide-react';
import MobileAccountMenu from './MobileAccountMenu';
import CreateMenu from '@/components/dashboard/create/CreateMenu';
import { useAssistant } from '@/components/dashboard/assistant/AssistantProvider';
import { AssistantMobileSearchBar } from '@/components/dashboard/assistant/AssistantSearchButton';
import { useUser } from '@/lib/hooks/useUser';
import { SHELL_BG_CLASS } from '@/lib/today/field';

/** Pages sans bandeau bleu (carte plein écran, tournée guidée). */
function hideShellHeader(pathname: string): boolean {
  return (
    pathname.startsWith('/dashboard/carte') || pathname.startsWith('/dashboard/tournee')
  );
}

function AccountButton({ onClick }: { onClick: () => void }) {
  const { profile } = useUser();
  const initials =
    `${profile.first_name.trim().charAt(0)}${profile.last_name.trim().charAt(0)}`.toUpperCase() ||
    '?';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Compte et réglages"
      className="app-press mt-0.5 flex size-11 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
      style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
    >
      {initials}
    </button>
  );
}

/**
 * Bandeau terrain partagé : Bonjour + prénom, recherche, +, compte.
 * Présent partout sauf Carte et Tournée.
 * Au tap recherche, la barre remplace le salut.
 */
export default function MobileChrome() {
  const pathname = usePathname();
  const { profile } = useUser();
  const [accountOpen, setAccountOpen] = useState(false);
  const { openMobileSearch, closeMobileSearch, mobileSearchOpen } = useAssistant();

  if (hideShellHeader(pathname)) return null;

  const prenom = profile.first_name.trim();
  const greeting = prenom ? `Bonjour ${prenom}.` : 'Bonjour.';

  return (
    <>
      <div className={`${SHELL_BG_CLASS} flex-shrink-0`}>
        <header
          className="relative z-[10] flex items-center gap-2 px-4 pb-3 pt-3"
          style={{ paddingTop: 'calc(12px + env(safe-area-inset-top, 0px))' }}
        >
          {mobileSearchOpen ? (
            <>
              <div className="min-w-0 flex-1">
                <AssistantMobileSearchBar tone="shell" />
              </div>
              <button
                type="button"
                onClick={closeMobileSearch}
                aria-label="Fermer la recherche"
                className="app-press flex size-11 flex-shrink-0 items-center justify-center rounded-full text-white"
                style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
              >
                <X size={20} strokeWidth={2} aria-hidden />
              </button>
            </>
          ) : (
            <>
              <div className="min-w-0 flex-1">
                <p
                  className="truncate font-brand font-normal tracking-[-0.015em] text-white"
                  style={{ fontSize: 24, lineHeight: 1.18 }}
                >
                  {greeting}
                </p>
              </div>
              <button
                type="button"
                onClick={openMobileSearch}
                aria-label="Rechercher"
                className="app-press mt-0.5 flex size-11 flex-shrink-0 items-center justify-center rounded-full text-white"
              >
                <Search size={20} strokeWidth={2} aria-hidden />
              </button>
              <CreateMenu compact className="mt-0.5" />
              <AccountButton onClick={() => setAccountOpen(true)} />
            </>
          )}
        </header>
      </div>
      <MobileAccountMenu open={accountOpen} onClose={() => setAccountOpen(false)} />
    </>
  );
}

export function MobileBackSwipe() {
  const pathname = usePathname();
  const router = useRouter();

  if (hideShellHeader(pathname)) return null;

  return (
    <div
      className="fixed inset-y-0 left-0 z-[40] w-5"
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
