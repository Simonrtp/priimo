'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HelpCircle } from 'lucide-react';
import { useUser } from '@/lib/hooks/useUser';
import { useDashboardTour } from '@/components/dashboard/tour/TourProvider';

function titleForPath(pathname: string): string {
  if (pathname === '/dashboard' || pathname === '/dashboard/') {
    return 'Prospects';
  }
  if (pathname === '/dashboard/settings' || pathname.startsWith('/dashboard/settings/')) {
    return 'Paramètres';
  }
  return 'Prospects';
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
      className="flex min-h-[52px] flex-shrink-0 items-center justify-between gap-2 border-b border-black/[0.06] px-4 backdrop-blur-xl max-md:bg-[rgba(249,250,255,0.78)] md:min-h-[48px] md:border-black/8 md:bg-canvas/80 md:px-8 md:backdrop-blur-md"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span
          className="min-w-0 truncate font-bold tracking-tight text-ink text-[19px] md:text-[15px] md:font-semibold"
          style={{ letterSpacing: '-0.02em', lineHeight: 1.2 }}
        >
          {title}
        </span>
      </div>

      <div className="flex flex-shrink-0 items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={startTour}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-mute transition-colors hover:bg-black/[0.04] hover:text-ink lg:h-9 lg:w-9"
          aria-label="Revoir le guide de prise en main"
          title="Revoir le guide"
        >
          <HelpCircle size={20} strokeWidth={2} aria-hidden />
        </button>

        <div className="flex min-w-0 max-w-[min(12rem,40vw)] items-center gap-2 sm:max-w-none sm:gap-3 lg:max-w-none">
          <span className="truncate font-medium text-ink" style={{ fontSize: 13 }} title={agency.name}>
            {agency.name}
          </span>
          <Link
            href="/dashboard/settings?tab=profile"
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-700 font-semibold tabular transition-colors hover:bg-primary-200 lg:h-[30px] lg:w-[30px]"
            style={{ fontSize: 11 }}
            aria-label="Mon profil"
            title="Mon profil"
          >
            {initials(profile.first_name, profile.last_name)}
          </Link>
        </div>
      </div>
    </header>
  );
}
