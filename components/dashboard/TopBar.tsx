'use client';

import { usePathname } from 'next/navigation';
import { HelpCircle } from 'lucide-react';
import WhatsAppIcon from '@/components/icons/WhatsAppIcon';
import { FOUNDER_WHATSAPP_HREF } from '@/lib/founder-contact';
import { useUser } from '@/lib/hooks/useUser';
import { useDashboardTour } from '@/components/dashboard/tour/TourProvider';

function titleForPath(pathname: string): string {
  if (pathname === '/dashboard' || pathname === '/dashboard/') {
    return 'Mes prospects';
  }
  if (pathname === '/dashboard/settings' || pathname.startsWith('/dashboard/settings/')) {
    return 'Paramètres';
  }
  return 'Dashboard';
}

function initials(firstName: string, lastName: string): string {
  return `${firstName.trim().charAt(0).toUpperCase()}${lastName.trim().charAt(0).toUpperCase()}` || '?';
}

export default function TopBar() {
  const pathname = usePathname();
  const title = titleForPath(pathname);
  const { profile, agency } = useUser();
  const { startTour } = useDashboardTour();

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
      </div>

      <div className="flex flex-shrink-0 items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={startTour}
          data-tour="guide-relaunch"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-mute transition-colors hover:bg-black/[0.04] hover:text-ink lg:h-9 lg:w-9"
          aria-label="Revoir le guide de prise en main"
          title="Revoir le guide"
        >
          <HelpCircle size={20} strokeWidth={2} aria-hidden />
        </button>

        <a
          href={FOUNDER_WHATSAPP_HREF}
          target="_blank"
          rel="noopener noreferrer"
          data-tour="whatsapp-mobile"
          className="flex lg:hidden h-11 w-11 shrink-0 items-center justify-center text-[#25D366] transition-opacity hover:opacity-80"
          aria-label="Écrire au fondateur sur WhatsApp"
        >
          <WhatsAppIcon size={22} />
        </a>

        <div className="flex min-w-0 max-w-[min(12rem,40vw)] items-center gap-2 sm:max-w-none sm:gap-3 lg:max-w-none">
          <span className="truncate font-medium text-ink" style={{ fontSize: 13 }} title={agency.name}>
            {agency.name}
          </span>
          <div
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent-dark font-semibold tabular lg:h-[30px] lg:w-[30px]"
            style={{ fontSize: 11 }}
            aria-hidden
          >
            {initials(profile.first_name, profile.last_name)}
          </div>
        </div>
      </div>
    </header>
  );
}
