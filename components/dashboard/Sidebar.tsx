'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut, Settings, Target } from 'lucide-react';
import WhatsAppIcon from '@/components/icons/WhatsAppIcon';
import { FOUNDER_WHATSAPP_HREF } from '@/lib/founder-contact';
import { formatZoneSidebarLabel } from '@/lib/zone-display';
import { useUser } from '@/lib/hooks/useUser';
const NAV_ICON = '#7B9AC0';
const ACCENT = '#E8743C';

interface SidebarProps {
  leadsThisMonth: number;
  monthlyQuota: number;
}

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

function userInitials(firstName: string, lastName: string): string {
  const a = firstName.trim().charAt(0).toUpperCase();
  const b = lastName.trim().charAt(0).toUpperCase();
  return `${a}${b}` || '?';
}

export default function Sidebar({ leadsThisMonth, monthlyQuota }: SidebarProps) {
  const pathname = usePathname();
  const { profile, agency, isDirector } = useUser();
  const progress = Math.min(100, Math.round((leadsThisMonth / Math.max(1, monthlyQuota)) * 100));
  const initials = userInitials(profile.first_name, profile.last_name);
  const zoneLabel = formatZoneSidebarLabel(agency);

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
          aria-label="Écrire au fondateur sur WhatsApp"
          className="group flex items-center gap-2 rounded-lg px-2 py-2 text-[12px] font-medium text-[#7B9AC0] transition-colors hover:text-white"
        >
          <WhatsAppIcon size={18} className="flex-shrink-0 text-[#25D366] group-hover:text-[#25D366]" />
          Écrire au fondateur
        </a>
      </div>

      <div
        className="mx-1.5 mb-3 hidden rounded-[12px] px-3 py-3 lg:mx-3 lg:block"
        style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
      >
        <p className="truncate font-medium text-white" style={{ fontSize: 14 }} title={agency.name}>
          {agency.name}
        </p>
        {zoneLabel && (
          <p
            className="mt-1.5 truncate text-[11px] leading-snug text-white/65"
            title={zoneLabel}
          >
            {zoneLabel}
          </p>
        )}
        {isDirector && (
          <>
            <p className="mt-3 text-[11px] tabular text-white/80">
              {leadsThisMonth}/{monthlyQuota} ce mois
            </p>
            <div
              className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full"
              style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
              role="progressbar"
              aria-valuenow={leadsThisMonth}
              aria-valuemin={0}
              aria-valuemax={monthlyQuota}
              aria-label="Progression des leads ce mois"
            >
              <div
                className="h-full rounded-full transition-[width] duration-300"
                style={{ width: `${progress}%`, backgroundColor: ACCENT }}
              />
            </div>
          </>
        )}
      </div>

      <div className="mx-1.5 mb-4 hidden items-center gap-2 rounded-[12px] px-3 py-2 lg:mx-3 lg:flex" style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}>
        <div
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] font-semibold text-white"
          aria-hidden
        >
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-medium text-white" title={`${profile.first_name} ${profile.last_name}`}>
            {profile.first_name} {profile.last_name}
          </p>
          <p className="truncate text-[10px] text-white/60" title={isDirector ? 'Directeur' : 'Collaborateur'}>
            {isDirector ? 'Directeur' : 'Collaborateur'}
          </p>
        </div>
        <form action="/api/auth/signout" method="post" className="flex-shrink-0">
          <button
            type="submit"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Se déconnecter"
            title="Se déconnecter"
          >
            <LogOut size={16} strokeWidth={2} aria-hidden />
          </button>
        </form>
      </div>
    </aside>
  );
}
