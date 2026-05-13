'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MessageCircle, Settings, Target } from 'lucide-react';
import { useDashboardRole } from '@/components/dashboard/DashboardRoleContext';
import { FOUNDER_WHATSAPP_HREF } from '@/lib/founder-contact';

const NAV_ICON = '#7B9AC0';
const ACCENT = '#E8743C';

const LEADS_QUOTA = { treated: 7, max: 15 };

const navItems: {
  href: string;
  label: string;
  Icon: typeof Target;
  match: (pathname: string) => boolean;
}[] = [
  {
    href: '/dashboard',
    label: 'Prospects',
    Icon: Target,
    match: (p) => p === '/dashboard' || p === '/dashboard/',
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
  const { isDirector } = useDashboardRole();
  const progress = Math.min(100, Math.round((LEADS_QUOTA.treated / LEADS_QUOTA.max) * 100));

  return (
    <aside
      className="hidden h-screen flex-shrink-0 flex-col border-r border-white/10 md:flex md:w-16 lg:w-[220px]"
      style={{
        background: 'linear-gradient(180deg, #1E3148 0%, #15202F 100%)',
      }}
    >
      <div className="px-2 pb-2 pt-5 lg:px-5">
        <span
          className="hidden font-bold tracking-tight lg:block"
          style={{ fontSize: 22, letterSpacing: '-0.03em', color: ACCENT }}
        >
          Priimo
        </span>
        <div
          className="flex h-10 w-10 items-center justify-center rounded-lg font-bold lg:hidden"
          style={{ backgroundColor: 'rgba(232,116,60,0.2)', color: ACCENT, fontSize: 16 }}
          aria-hidden
        >
          P
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 px-1.5 pt-3 lg:px-3" aria-label="Navigation principale">
        {navItems.map(({ href, label, Icon, match }) => {
          const active = match(pathname);
          return (
            <Link
              key={href}
              href={href}
              title={label}
              className={`flex items-center justify-center gap-3 border-l-[3px] py-2.5 font-medium transition-colors duration-150 lg:justify-start lg:pl-[9px] lg:pr-3 ${
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
              <span className="hidden lg:inline">{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="hidden px-3 pb-3 lg:block">
        <a
          href={FOUNDER_WHATSAPP_HREF}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-2 rounded-lg px-2 py-2 text-[12px] font-medium text-[#7B9AC0] transition-colors hover:text-white"
        >
          <MessageCircle size={16} strokeWidth={2} className="flex-shrink-0 opacity-90" aria-hidden />
          Écrire au fondateur
        </a>
      </div>

      {isDirector ? (
        <div
          className="mx-1.5 mb-4 hidden rounded-[12px] px-3 py-3 lg:mx-3 lg:block"
          style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
        >
          <p className="font-medium text-white" style={{ fontSize: 14 }}>
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
      ) : (
        <div
          className="mx-1.5 mb-4 hidden rounded-[12px] px-3 py-3 lg:mx-3 lg:block"
          style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
        >
          <p className="font-medium text-white" style={{ fontSize: 14 }}>
            Agence Test
          </p>
          <p className="mt-2 text-[12px] text-white/75">Agent</p>
        </div>
      )}
    </aside>
  );
}
