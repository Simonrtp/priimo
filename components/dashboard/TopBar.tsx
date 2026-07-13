'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';
import { toast } from 'sonner';
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

function MobileAgencySwitcher() {
  const router = useRouter();
  const { agency, memberships, hasMultipleAgencies } = useUser();
  const [saving, setSaving] = useState(false);

  if (!hasMultipleAgencies) {
    return (
      <span className="truncate font-medium text-ink md:hidden" style={{ fontSize: 13 }} title={agency.name}>
        {agency.name}
      </span>
    );
  }

  return (
    <div className="relative min-w-0 max-w-[min(11rem,38vw)] md:hidden">
      <label htmlFor="topbar-agency-switcher" className="sr-only">
        Agence active
      </label>
      <select
        id="topbar-agency-switcher"
        value={agency.id}
        disabled={saving}
        onChange={async (e) => {
          const agencyId = e.target.value;
          if (agencyId === agency.id || saving) return;
          setSaving(true);
          try {
            const res = await fetch('/api/dashboard/active-agency', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ agencyId }),
            });
            const data = (await res.json()) as { error?: string };
            if (!res.ok) {
              toast.error(data.error ?? "Impossible de changer d'agence");
              return;
            }
            router.refresh();
          } catch {
            toast.error("Impossible de changer d'agence");
          } finally {
            setSaving(false);
          }
        }}
        className="w-full appearance-none truncate rounded-lg border border-black/10 bg-white py-1 pl-2 pr-7 text-[12px] font-medium text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-60"
        aria-label="Choisir l'agence active"
      >
        {memberships.map((m) => (
          <option key={m.agency_id} value={m.agency_id}>
            {m.agency?.name ?? 'Agence'}
          </option>
        ))}
      </select>
      <ChevronDown
        size={14}
        className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-mute"
        aria-hidden
      />
    </div>
  );
}

export default function TopBar() {
  const pathname = usePathname();
  const title = titleForPath(pathname);
  const { profile, agency, hasMultipleAgencies } = useUser();
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
        {hasMultipleAgencies ? (
          <span
            className="hidden truncate font-medium text-mute md:inline"
            style={{ fontSize: 13 }}
            title={agency.name}
          >
            · {agency.name}
          </span>
        ) : null}
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
          <MobileAgencySwitcher />
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
