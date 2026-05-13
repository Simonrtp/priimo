'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, LogOut, MapPin, Menu, Settings, Target, X } from 'lucide-react';

const ACCENT = '#E8743C';
const INACTIVE = '#6B7280';

const LEADS_QUOTA = { treated: 7, max: 15 };

function matchProspects(p: string) {
  return p === '/dashboard' || p === '/dashboard/';
}

function TabItem({
  href,
  label,
  Icon,
  active,
}: {
  href: string;
  label: string;
  Icon: typeof BarChart3;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-[44px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 pt-1"
      style={{ paddingBottom: 'max(4px, env(safe-area-inset-bottom))' }}
    >
      <Icon size={24} strokeWidth={2} color={active ? ACCENT : INACTIVE} aria-hidden />
      <span
        className="max-w-full truncate text-center font-medium"
        style={{ fontSize: 11, color: active ? ACCENT : INACTIVE }}
      >
        {label}
      </span>
    </Link>
  );
}

export default function MobileBottomNav() {
  const pathname = usePathname();
  const [plusOpen, setPlusOpen] = useState(false);

  useEffect(() => {
    if (!plusOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [plusOpen]);

  const activeOverview = pathname === '/dashboard/overview' || pathname.startsWith('/dashboard/overview/');
  const activeProspects = matchProspects(pathname);
  const activeTerritory = pathname === '/dashboard/territory' || pathname.startsWith('/dashboard/territory/');
  const activePlus =
    pathname === '/dashboard/settings' ||
    pathname.startsWith('/dashboard/settings/');

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 flex border-t border-gray-200 bg-white md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        aria-label="Navigation mobile"
      >
        <TabItem href="/dashboard/overview" label="Accueil" Icon={BarChart3} active={activeOverview} />
        <TabItem href="/dashboard" label="Prospects" Icon={Target} active={activeProspects} />
        <TabItem href="/dashboard/territory" label="Territoire" Icon={MapPin} active={activeTerritory} />
        <button
          type="button"
          onClick={() => setPlusOpen(true)}
          className="flex min-h-[44px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 pt-1"
          style={{ paddingBottom: 'max(4px, env(safe-area-inset-bottom))' }}
        >
          <Menu size={24} strokeWidth={2} color={plusOpen || activePlus ? ACCENT : INACTIVE} aria-hidden />
          <span className="font-medium" style={{ fontSize: 11, color: plusOpen || activePlus ? ACCENT : INACTIVE }}>
            Plus
          </span>
        </button>
      </nav>

      {plusOpen && (
        <div className="fixed inset-0 z-[60] md:hidden" role="dialog" aria-modal="true" aria-label="Menu Plus">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Fermer"
            onClick={() => setPlusOpen(false)}
          />
          <div
            className="absolute bottom-0 left-0 right-0 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-white shadow-xl"
            style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
          >
            <div className="flex items-center justify-between border-b border-black/8 px-4 py-3">
              <span className="font-semibold text-ink" style={{ fontSize: 16 }}>
                Plus
              </span>
              <button
                type="button"
                className="flex h-11 w-11 items-center justify-center rounded-lg text-mute hover:bg-black/[0.05]"
                onClick={() => setPlusOpen(false)}
                aria-label="Fermer"
              >
                <X size={22} strokeWidth={2} />
              </button>
            </div>
            <ul className="py-2">
              <li>
                <Link
                  href="/dashboard/settings"
                  className="flex min-h-[48px] items-center gap-3 px-4 py-3 text-[15px] font-medium text-ink hover:bg-black/[0.03]"
                  onClick={() => setPlusOpen(false)}
                >
                  <Settings size={20} strokeWidth={2} className="text-mute" aria-hidden />
                  Paramètres
                </Link>
              </li>
              <li>
                <a
                  href="mailto:support@priimo.fr"
                  className="flex min-h-[48px] items-center gap-3 px-4 py-3 text-[15px] font-medium text-ink hover:bg-black/[0.03]"
                  onClick={() => setPlusOpen(false)}
                >
                  Aide &amp; support
                </a>
              </li>
              <li className="mx-4 my-2 rounded-xl border border-black/8 bg-soft-gray/50 px-3 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-accent-dark">Mon plan</p>
                <p className="mt-1 font-semibold text-ink" style={{ fontSize: 14 }}>
                  Plan Fondateur
                </p>
                <p className="text-mute tabular" style={{ fontSize: 12 }}>
                  {LEADS_QUOTA.treated}/{LEADS_QUOTA.max} leads traités
                </p>
              </li>
              <li>
                <button
                  type="button"
                  className="flex min-h-[48px] w-full items-center gap-3 px-4 py-3 text-left text-[15px] font-medium text-red-700 hover:bg-red-50"
                  onClick={() => {
                    console.log('[MobileBottomNav] Déconnexion');
                    setPlusOpen(false);
                  }}
                >
                  <LogOut size={20} strokeWidth={2} aria-hidden />
                  Déconnexion
                </button>
              </li>
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
