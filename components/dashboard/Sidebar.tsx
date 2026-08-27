'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useState } from 'react';
import {
  Building2,
  Calculator,
  CalendarCheck,
  LogOut,
  Map,
  Settings,
  Target,
  Users,
} from 'lucide-react';
import WhatsAppIcon from '@/components/icons/WhatsAppIcon';
import { FOUNDER_WHATSAPP_HREF } from '@/lib/founder-contact';
import { PriimoLogo } from '@/components/brand/PriimoLogo';
import InstallAppButton from '@/components/pwa/InstallAppButton';
import SidebarCollapseTab from '@/components/dashboard/SidebarCollapseTab';
import NoteCreateChooser from '@/components/dashboard/notes/NoteCreateChooser';
import { useUser } from '@/lib/hooks/useUser';
import { SHELL_BG_CLASS } from '@/lib/today/field';

const NAV_ICON = '#7B9AC0';
const STORAGE_KEY = 'priimo-sidebar-collapsed';

type NavItem = {
  href: string;
  label: string;
  Icon: typeof Target;
  match: (pathname: string) => boolean;
};

const NAV_GROUPS: NavItem[][] = [
  [
    {
      href: '/dashboard',
      label: 'Accueil',
      Icon: CalendarCheck,
      match: (p) => p === '/dashboard' || p === '/dashboard/',
    },
  ],
  [
    {
      href: '/dashboard/prospection',
      label: 'Prospection',
      Icon: Target,
      match: (p) => p.startsWith('/dashboard/prospection'),
    },
    {
      href: '/dashboard/estimation',
      label: 'Estimation',
      Icon: Calculator,
      match: (p) => p.startsWith('/dashboard/estimation'),
    },
    {
      href: '/dashboard/carte',
      label: 'Carte',
      Icon: Map,
      match: (p) => p.startsWith('/dashboard/carte'),
    },
    {
      href: '/dashboard/contacts',
      label: 'Contacts',
      Icon: Users,
      match: (p) => p.startsWith('/dashboard/contacts'),
    },
    {
      href: '/dashboard/biens',
      label: 'Biens',
      Icon: Building2,
      match: (p) => p.startsWith('/dashboard/biens'),
    },
  ],
  [
    {
      href: '/dashboard/settings',
      label: 'Paramètres',
      Icon: Settings,
      match: (p) => p.startsWith('/dashboard/settings') || p.startsWith('/dashboard/parametres'),
    },
  ],
];

function NavDivider({ collapsed }: { collapsed: boolean }) {
  return (
    <div
      role="separator"
      className={`my-2 ${collapsed ? 'mx-2.5' : 'mx-1 md:mx-2'}`}
      aria-hidden
    >
      <div className="h-px bg-white/[0.12]" />
    </div>
  );
}

function readCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function userInitials(firstName: string, lastName: string): string {
  const a = firstName.trim().charAt(0).toUpperCase();
  const b = lastName.trim().charAt(0).toUpperCase();
  return `${a}${b}` || '?';
}

export default function Sidebar() {
  const pathname = usePathname();
  const { profile } = useUser();
  const initials = userInitials(profile.first_name, profile.last_name);
  const [collapsed, setCollapsed] = useState(readCollapsed);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      } catch {
        /* quota / mode privé */
      }
      return next;
    });
  }, []);

  return (
    <aside
      id="dashboard-sidebar"
      data-collapsed={collapsed ? 'true' : 'false'}
      suppressHydrationWarning
      className={`${SHELL_BG_CLASS} relative z-[45] hidden h-dvh shrink-0 flex-col md:flex`}
    >
      <div
        className={`flex items-center pb-2 pt-5 ${collapsed ? 'justify-center px-2' : 'justify-between px-2 md:px-4'}`}
      >
        <Link href="/dashboard" className={collapsed ? 'block' : 'hidden md:block'} aria-label="Priimo">
          {collapsed ? (
            <PriimoLogo variant="mark" className="size-9" />
          ) : (
            <PriimoLogo className="h-12" />
          )}
        </Link>
        <Link href="/dashboard" className="mx-auto block size-9 md:hidden" aria-label="Priimo">
          <PriimoLogo variant="mark" className="size-9" />
        </Link>
      </div>

      <nav
        className={`flex flex-1 flex-col gap-0.5 pt-3 ${collapsed ? 'px-1.5' : 'px-1.5 md:px-3'}`}
        aria-label="Navigation principale"
      >
        {NAV_GROUPS.map((group, groupIndex) => (
          <div key={groupIndex}>
            {groupIndex > 0 ? <NavDivider collapsed={collapsed} /> : null}
            {group.map(({ href, label, Icon, match }) => {
              const active = match(pathname);
              return (
                <Link
                  key={href}
                  href={href}
                  title={label}
                  aria-current={active ? 'page' : undefined}
                  aria-label={collapsed ? label : undefined}
                  className={`flex items-center border-l-[3px] py-2.5 font-medium transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 ${
                    collapsed
                      ? 'justify-center rounded-xl border-transparent px-0'
                      : 'gap-3 md:justify-start md:pl-[9px] md:pr-3'
                  } ${
                    active
                      ? collapsed
                        ? 'border-transparent bg-white/[0.08] text-white'
                        : 'rounded-r-xl border-[#E8743C] bg-white/[0.08] text-white'
                      : 'rounded-xl border-transparent text-[#B8CDE3] hover:bg-white/[0.05]'
                  }`}
                  style={{ fontSize: 13.5 }}
                >
                  <Icon
                    size={18}
                    strokeWidth={2}
                    style={{ color: active ? '#FFFFFF' : NAV_ICON }}
                    className="shrink-0"
                    aria-hidden
                  />
                  <span className="sidebar-nav-label hidden overflow-hidden whitespace-nowrap md:inline">{label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className={`pb-3 ${collapsed ? 'px-1.5' : 'px-1.5 md:px-3'}`}>
        <div className={`mb-0.5 flex ${collapsed ? 'justify-center' : 'justify-end'}`}>
          <SidebarCollapseTab collapsed={collapsed} onToggle={toggleCollapsed} />
        </div>
        <NoteCreateChooser variant="sidebar" collapsed={collapsed} />
      </div>

      <div className="sidebar-footer-extra">
        <div className="hidden px-3 pb-1 md:block">
          <InstallAppButton />
        </div>

        <div className="hidden px-3 pb-3 md:block">
          <a
            href={FOUNDER_WHATSAPP_HREF}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Écrire au fondateur sur WhatsApp"
            data-tour="whatsapp"
            className="group flex items-center gap-2 rounded-lg px-2 py-2 text-[12px] font-medium text-[#7B9AC0] transition-colors hover:text-white"
          >
            <WhatsAppIcon size={18} className="shrink-0 text-[#25D366] group-hover:text-[#25D366]" />
            Écrire au fondateur
          </a>
        </div>
      </div>

      <div className="mb-4 flex flex-col items-center gap-1.5 px-1.5 md:hidden">
        <Link
          href="/dashboard/settings"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-[11px] font-semibold text-white transition-colors hover:bg-white/20"
          title="Mon compte et les paramètres"
          aria-label="Mon compte et les paramètres"
        >
          {initials}
        </Link>
        <form action="/api/auth/signout" method="post">
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
