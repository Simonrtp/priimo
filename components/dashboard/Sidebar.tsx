'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Building2, CalendarCheck, LogOut, Mic, Settings, Target, Users } from 'lucide-react';
import WhatsAppIcon from '@/components/icons/WhatsAppIcon';
import { FOUNDER_WHATSAPP_HREF } from '@/lib/founder-contact';
import { PriimoLogo } from '@/components/brand/PriimoLogo';
import InstallAppButton from '@/components/pwa/InstallAppButton';
import { useVoiceCapture } from '@/components/dashboard/voice/VoiceCaptureProvider';
import { useUser } from '@/lib/hooks/useUser';

const NAV_ICON = '#7B9AC0';

const navItems: {
  href: string;
  label: string;
  Icon: typeof Target;
  match: (pathname: string) => boolean;
}[] = [
  {
    href: '/dashboard',
    label: "Aujourd'hui",
    Icon: CalendarCheck,
    match: (p) => p === '/dashboard' || p === '/dashboard/',
  },
  {
    href: '/dashboard/prospection',
    label: 'Prospection',
    Icon: Target,
    match: (p) => p.startsWith('/dashboard/prospection'),
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
  {
    href: '/dashboard/settings',
    label: 'Paramètres',
    Icon: Settings,
    match: (p) => p.startsWith('/dashboard/settings') || p.startsWith('/dashboard/parametres'),
  },
];

function userInitials(firstName: string, lastName: string): string {
  const a = firstName.trim().charAt(0).toUpperCase();
  const b = lastName.trim().charAt(0).toUpperCase();
  return `${a}${b}` || '?';
}

export default function Sidebar() {
  const pathname = usePathname();
  const { profile } = useUser();
  const { openCapture } = useVoiceCapture();
  const initials = userInitials(profile.first_name, profile.last_name);

  return (
    <aside
      id="dashboard-sidebar"
      className="relative z-[45] hidden h-screen w-[220px] flex-shrink-0 flex-col md:flex"
      style={{
        background: 'linear-gradient(180deg, #1E3148 0%, #15202F 100%)',
      }}
    >
      <div className="flex items-center justify-between px-2 pb-2 pt-5 md:px-4">
        <Link href="/dashboard" className="hidden md:block">
          <PriimoLogo className="h-12" />
        </Link>
        <Link href="/dashboard" className="mx-auto block size-9 md:hidden" aria-label="Priimo">
          <PriimoLogo variant="mark" className="size-9" />
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 px-1.5 pt-3 md:px-3" aria-label="Navigation principale">
        {navItems.map(({ href, label, Icon, match }) => {
          const active = match(pathname);
          return (
            <Link
              key={href}
              href={href}
              title={label}
              aria-current={active ? 'page' : undefined}
              className={`flex items-center gap-3 border-l-[3px] py-2.5 font-medium transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 md:justify-start md:pl-[9px] md:pr-3 ${
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
              <span className="hidden md:inline">{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="px-1.5 pb-3 md:px-3">
        <button
          type="button"
          onClick={() => openCapture()}
          data-tour="voice-capture"
          aria-label="Dicter une note"
          title="Dicter une note"
          className="flex w-full items-center gap-3 rounded-[12px] border border-[#E8743C]/25 bg-[#E8743C]/12 px-3 py-2.5 text-left transition-colors duration-150 hover:bg-[#E8743C]/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#E8743C] text-white"
            aria-hidden
          >
            <Mic size={18} strokeWidth={2.2} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-white" style={{ fontSize: 13.5 }}>
              Dicter une note
            </span>
            <span className="mt-0.5 block text-[11px] leading-snug text-[#B8CDE3]">
              Ce que vous venez de vivre
            </span>
          </span>
        </button>
      </div>

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
          <WhatsAppIcon size={18} className="flex-shrink-0 text-[#25D366] group-hover:text-[#25D366]" />
          Écrire au fondateur
        </a>
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
