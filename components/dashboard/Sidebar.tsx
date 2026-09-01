'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useState, type ComponentType } from 'react';
import { useOnboardingNavLock } from '@/lib/hooks/useOnboardingNavLock';
import { LogOut } from 'lucide-react';
import WhatsAppIcon from '@/components/icons/WhatsAppIcon';
import { FOUNDER_WHATSAPP_HREF } from '@/lib/founder-contact';
import { PriimoLogo } from '@/components/brand/PriimoLogo';
import InstallAppButton from '@/components/pwa/InstallAppButton';
import SidebarCollapseTab from '@/components/dashboard/SidebarCollapseTab';
import { useUser } from '@/lib/hooks/useUser';
import { SHELL_BG_CLASS } from '@/lib/today/field';
import ProfileAvatar from '@/components/dashboard/ProfileAvatar';
import {
  IconAccueil,
  IconBiens,
  IconContacts,
  IconEstimation,
  IconParametres,
  IconProspection,
  IconActions,
} from '@/components/dashboard/nav-icons/NavIcon';

const STORAGE_KEY = 'priimo-sidebar-collapsed';

type NavIconProps = { active?: boolean; className?: string };

type NavItem = {
  href: string;
  label: string;
  Icon: ComponentType<NavIconProps>;
  match: (pathname: string) => boolean;
};

const NAV_GROUPS: NavItem[][] = [
  [
    {
      href: '/dashboard',
      label: 'Accueil',
      Icon: IconAccueil,
      match: (p) => p === '/dashboard' || p === '/dashboard/',
    },
    {
      href: '/dashboard/actions',
      label: 'À valider',
      Icon: IconActions,
      match: (p) => p.startsWith('/dashboard/actions'),
    },
  ],
  [
    {
      href: '/dashboard/prospection',
      label: 'Prospection',
      Icon: IconProspection,
      match: (p) => p.startsWith('/dashboard/prospection') || p.startsWith('/dashboard/carte'),
    },
    {
      href: '/dashboard/estimation',
      label: 'Estimation',
      Icon: IconEstimation,
      match: (p) => p.startsWith('/dashboard/estimation'),
    },
    {
      href: '/dashboard/contacts',
      label: 'Contacts',
      Icon: IconContacts,
      match: (p) => p.startsWith('/dashboard/contacts'),
    },
    {
      href: '/dashboard/biens',
      label: 'Biens',
      Icon: IconBiens,
      match: (p) => p.startsWith('/dashboard/biens'),
    },
  ],
  [
    {
      href: '/dashboard/settings',
      label: 'Paramètres',
      Icon: IconParametres,
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

export default function Sidebar() {
  const pathname = usePathname();
  const { profile } = useUser();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const navLocked = useOnboardingNavLock();

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
                  title={navLocked ? 'Disponible après la prise en main' : label}
                  data-onboarding-nav={navLocked ? '' : undefined}
                  aria-disabled={navLocked || undefined}
                  aria-current={active ? 'page' : undefined}
                  aria-label={collapsed ? label : undefined}
                  onClick={(e) => {
                    if (navLocked) e.preventDefault();
                  }}
                  className={`nav-link flex items-center border-l-[3px] py-2.5 font-medium transition-colors duration-fluid-subtle ease-in-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 ${
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
                  <Icon active={active} className="shrink-0" />
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
            aria-label="Nous écrire sur WhatsApp"
            data-tour="whatsapp"
            className="group flex items-center gap-2 rounded-lg px-2 py-2 text-[12px] font-medium text-[#7B9AC0] transition-colors duration-fluid-subtle ease-in-out hover:text-white"
          >
            <WhatsAppIcon size={18} className="shrink-0 text-[#25D366] group-hover:text-[#25D366]" />
            Nous écrire
          </a>
        </div>
      </div>

      <div className="mb-4 flex flex-col items-center gap-1.5 px-1.5 md:hidden">
        <Link
          href="/dashboard/settings"
          className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-white/10 text-[11px] font-semibold text-white transition-colors duration-fluid-subtle ease-in-out hover:bg-white/20"
          title="Mon compte et les paramètres"
          aria-label="Mon compte et les paramètres"
        >
          <ProfileAvatar
            firstName={profile.first_name}
            lastName={profile.last_name}
            avatarUrl={profile.avatar_url}
            size={36}
            className="bg-white/10 text-white"
          />
        </Link>
        <form action="/api/auth/signout" method="post">
          <button
            type="submit"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/60 transition-colors duration-fluid-subtle ease-in-out hover:bg-white/10 hover:text-white"
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
