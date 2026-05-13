'use client';

import { usePathname } from 'next/navigation';
import WhatsAppIcon from '@/components/icons/WhatsAppIcon';
import { FOUNDER_WHATSAPP_HREF } from '@/lib/founder-contact';
import { useDashboardRole } from '@/components/dashboard/DashboardRoleContext';

const isDev = process.env.NODE_ENV === 'development';

function titleForPath(pathname: string): string {
  if (pathname === '/dashboard' || pathname === '/dashboard/') {
    return 'Mes prospects';
  }
  if (pathname === '/dashboard/settings' || pathname.startsWith('/dashboard/settings/')) {
    return 'Paramètres';
  }
  return 'Dashboard';
}

export default function TopBar() {
  const pathname = usePathname();
  const title = titleForPath(pathname);
  const { role, setRole } = useDashboardRole();

  return (
    <header
      className="flex min-h-[48px] flex-shrink-0 items-center justify-between gap-2 border-b border-black/8 bg-canvas/80 px-4 backdrop-blur-md md:px-8"
      style={{ height: undefined }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span
          className="min-w-0 truncate font-semibold tracking-tight text-ink max-md:text-[15px]"
          style={{ fontSize: 15, letterSpacing: '-0.01em', lineHeight: 1.25 }}
        >
          {title === 'Mes prospects' ? 'Prospects' : title}
        </span>
        {isDev && (
          <div
            className="flex shrink-0 flex-wrap items-center gap-1 rounded-lg border border-black/10 bg-white/90 px-1.5 py-1"
            role="group"
            aria-label="Simulation de rôle (développement)"
          >
            <span className="pl-1 text-[10px] font-medium uppercase tracking-wide text-mute">Vue</span>
            <button
              type="button"
              onClick={() => setRole('director')}
              className={`rounded px-2 py-0.5 text-[11px] font-semibold ${
                role === 'director' ? 'bg-accent text-white' : 'text-mute hover:bg-black/[0.05]'
              }`}
            >
              Directeur
            </button>
            <button
              type="button"
              onClick={() => setRole('agent')}
              className={`rounded px-2 py-0.5 text-[11px] font-semibold ${
                role === 'agent' ? 'bg-accent text-white' : 'text-mute hover:bg-black/[0.05]'
              }`}
            >
              Agent
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-shrink-0 items-center gap-2 sm:gap-3">
        <a
          href={FOUNDER_WHATSAPP_HREF}
          target="_blank"
          rel="noopener noreferrer"
          className="flex lg:hidden h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border border-black/10 text-[#25D366] transition-colors hover:bg-black/[0.04]"
          aria-label="Écrire au fondateur sur WhatsApp"
        >
          <WhatsAppIcon size={22} />
        </a>

        <div className="flex min-w-0 max-w-[min(12rem,40vw)] items-center gap-2 sm:max-w-none sm:gap-3 lg:max-w-none">
          <span className="truncate font-medium text-ink" style={{ fontSize: 13 }}>
            Agence Test
          </span>
          <div
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent-dark font-semibold tabular lg:h-[30px] lg:w-[30px]"
            style={{ fontSize: 11 }}
            aria-hidden
          >
            AT
          </div>
        </div>
      </div>
    </header>
  );
}
