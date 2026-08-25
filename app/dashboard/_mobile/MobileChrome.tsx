'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import MobileAccountMenu, { AvatarButton } from './MobileAccountMenu';

function titleForPath(pathname: string): string {
  if (pathname.startsWith('/dashboard/prospection')) return 'Prospection';
  if (pathname.startsWith('/dashboard/contacts')) return 'Contacts';
  if (pathname.startsWith('/dashboard/biens')) return 'Biens';
  if (pathname.startsWith('/dashboard/parametres')) return 'Équipe';
  if (pathname.startsWith('/dashboard/equipe')) return 'Équipe';
  if (pathname.startsWith('/dashboard/settings')) return 'Paramètres';
  return '';
}

function isFieldPath(pathname: string): boolean {
  return (
    pathname === '/dashboard' ||
    pathname === '/dashboard/' ||
    pathname.startsWith('/dashboard/carte')
  );
}

export default function MobileChrome() {
  const pathname = usePathname();
  const router = useRouter();
  const [accountOpen, setAccountOpen] = useState(false);

  if (isFieldPath(pathname)) return null;

  const title = titleForPath(pathname);

  return (
    <>
      <header
        className="flex flex-shrink-0 items-center gap-2 border-b border-black/[0.06] bg-surface px-3"
        style={{
          paddingTop: 'env(safe-area-inset-top, 0px)',
          minHeight: 'calc(52px + env(safe-area-inset-top, 0px))',
        }}
      >
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Retour"
          className="app-press flex size-11 items-center justify-center rounded-full text-text"
        >
          <ChevronLeft size={22} strokeWidth={2} aria-hidden />
        </button>
        <h1 className="min-w-0 flex-1 truncate font-semibold text-text-strong" style={{ fontSize: 17 }}>
          {title}
        </h1>
        <AvatarButton onClick={() => setAccountOpen(true)} />
      </header>
      <MobileAccountMenu open={accountOpen} onClose={() => setAccountOpen(false)} />
    </>
  );
}

export function MobileBackSwipe() {
  const pathname = usePathname();
  const router = useRouter();

  if (isFieldPath(pathname)) return null;

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
