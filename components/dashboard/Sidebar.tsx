'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  HelpCircle,
  MapPin,
  Settings,
  Target,
} from 'lucide-react';

const NAV_ICON = '#7B9AC0';
const ACCENT = '#E8743C';

/** Quota plan Fondateur (démo) — aligné avec la copie « X/15 ». */
const LEADS_QUOTA = { treated: 7, max: 15 };

const navItems: {
  href: string;
  label: string;
  Icon: typeof BarChart3;
  match: (pathname: string) => boolean;
}[] = [
  {
    href: '/dashboard/overview',
    label: 'Tableau de bord',
    Icon: BarChart3,
    match: (p) => p === '/dashboard/overview' || p.startsWith('/dashboard/overview/'),
  },
  {
    href: '/dashboard',
    label: 'Prospects',
    Icon: Target,
    match: (p) => p === '/dashboard' || p === '/dashboard/',
  },
  {
    href: '/dashboard/territory',
    label: 'Mon territoire',
    Icon: MapPin,
    match: (p) => p === '/dashboard/territory' || p.startsWith('/dashboard/territory/'),
  },
  {
    href: '/dashboard/settings',
    label: 'Paramètres',
    Icon: Settings,
    match: (p) => p === '/dashboard/settings' || p.startsWith('/dashboard/settings/'),
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const progress = Math.min(100, Math.round((LEADS_QUOTA.treated / LEADS_QUOTA.max) * 100));

  return (
    <aside
      className="flex h-screen flex-shrink-0 flex-col border-r border-white/10"
      style={{
        width: 220,
        background: 'linear-gradient(180deg, #1E3148 0%, #15202F 100%)',
      }}
    >
      <div className="px-5 pb-2 pt-6">
        <span
          className="font-bold tracking-tight"
          style={{ fontSize: 22, letterSpacing: '-0.03em', color: ACCENT }}
        >
          Priimo
        </span>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 px-3 pt-4" aria-label="Navigation principale">
        {navItems.map(({ href, label, Icon, match }) => {
          const active = match(pathname);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 border-l-[3px] py-2.5 pl-[9px] pr-3 font-medium transition-colors duration-150 ${
                active
                  ? 'rounded-r-xl border-[#E8743C] bg-white/[0.08] text-white'
                  : 'rounded-xl border-transparent text-[#B8CDE3] hover:bg-white/[0.05]'
              }`}
              style={{ fontSize: 13.5 }}
            >
              <Icon
                size={18}
                strokeWidth={2}
                style={{ color: active ? '#FFFFFF' : NAV_ICON }}
                className="flex-shrink-0"
                aria-hidden
              />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 pb-3">
        <a
          href="mailto:support@priimo.fr"
          className="group flex items-center gap-2 rounded-lg px-2 py-2 text-[12px] font-medium text-[#7B9AC0] transition-colors hover:text-white"
        >
          <HelpCircle size={16} strokeWidth={2} className="flex-shrink-0 opacity-90" aria-hidden />
          Aide &amp; support
        </a>
      </div>

      <div
        className="mx-3 mb-4 rounded-[12px] px-3 py-3"
        style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
      >
        <p
          className="inline-block rounded-md px-2 py-0.5 font-semibold uppercase tracking-wide"
          style={{
            fontSize: 9,
            letterSpacing: '0.1em',
            color: ACCENT,
            backgroundColor: 'rgba(232,116,60,0.15)',
          }}
        >
          PLAN FONDATEUR
        </p>
        <p className="mt-2 font-medium text-white" style={{ fontSize: 14 }}>
          Agence Test
        </p>
        <p className="mt-3 text-[11px] tabular text-white/80">
          {LEADS_QUOTA.treated}/{LEADS_QUOTA.max} leads traités
        </p>
        <div
          className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full"
          style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
          role="progressbar"
          aria-valuenow={LEADS_QUOTA.treated}
          aria-valuemin={0}
          aria-valuemax={LEADS_QUOTA.max}
          aria-label="Progression des leads traités"
        >
          <div
            className="h-full rounded-full transition-[width] duration-300"
            style={{ width: `${progress}%`, backgroundColor: ACCENT }}
          />
        </div>
      </div>
    </aside>
  );
}
