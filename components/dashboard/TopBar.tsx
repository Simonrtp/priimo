'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useUser } from '@/lib/hooks/useUser';
import { useDashboardTour } from '@/components/dashboard/tour/TourProvider';
import {
  AssistantSearchBar,
  AssistantMobileSearchBar,
  AssistantSearchIconButton,
} from '@/components/dashboard/assistant/AssistantSearchButton';
import AssistantPanel from '@/components/dashboard/assistant/AssistantPanel';
import WhatsAppIcon from '@/components/icons/WhatsAppIcon';
import { FOUNDER_WHATSAPP_HREF } from '@/lib/founder-contact';
import CreateMenu from '@/components/dashboard/create/CreateMenu';

function titleForPath(pathname: string): string {
  if (pathname === '/dashboard' || pathname === '/dashboard/') return 'Accueil';
  if (pathname.startsWith('/dashboard/carte')) return 'Carte';
  if (pathname.startsWith('/dashboard/prospection')) return 'Prospection';
  if (pathname.startsWith('/dashboard/estimation')) return 'Estimation';
  if (pathname.startsWith('/dashboard/contacts')) return 'Contacts';
  if (pathname.startsWith('/dashboard/biens')) return 'Biens';
  if (pathname.startsWith('/dashboard/parametres')) return 'Équipe';
  if (pathname.startsWith('/dashboard/equipe')) return 'Équipe';
  if (pathname.startsWith('/dashboard/settings')) return 'Paramètres';
  if (pathname.startsWith('/dashboard/notes')) return 'Notes';
  return 'Accueil';
}

function initials(firstName: string, lastName: string): string {
  return `${firstName.trim().charAt(0).toUpperCase()}${lastName.trim().charAt(0).toUpperCase()}` || '?';
}

function MobileAgencySwitcher({ className = '' }: { className?: string }) {
  const router = useRouter();
  const { agency, memberships, hasMultipleAgencies } = useUser();
  const [saving, setSaving] = useState(false);

  if (!hasMultipleAgencies) {
    return (
      <span
        className={`truncate font-medium text-ink ${className}`}
        style={{ fontSize: 13 }}
        title={agency.name}
      >
        {agency.name}
      </span>
    );
  }

  return (
    <div className={`relative min-w-0 max-w-[min(11rem,38vw)] sm:max-w-[14rem] ${className}`}>
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

function ShellAgencySwitcher() {
  const router = useRouter();
  const { agency, memberships, hasMultipleAgencies } = useUser();
  const [saving, setSaving] = useState(false);

  if (!hasMultipleAgencies) {
    return (
      <span className="max-w-[12rem] truncate text-[13px] font-medium text-white/90" title={agency.name}>
        {agency.name}
      </span>
    );
  }

  return (
    <div className="relative min-w-0 max-w-[12rem]">
      <label htmlFor="shell-agency-switcher" className="sr-only">
        Agence active
      </label>
      <select
        id="shell-agency-switcher"
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
        className="w-full appearance-none truncate rounded-lg border border-white/15 bg-white/10 py-1 pl-2 pr-7 text-[12px] font-medium text-white outline-none focus:border-white/30 focus:ring-2 focus:ring-white/15 disabled:opacity-60"
        aria-label="Choisir l'agence active"
      >
        {memberships.map((m) => (
          <option key={m.agency_id} value={m.agency_id} className="text-ink">
            {m.agency?.name ?? 'Agence'}
          </option>
        ))}
      </select>
      <ChevronDown
        size={14}
        className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-white/70"
        aria-hidden
      />
    </div>
  );
}

function HeaderProfile({
  firstName,
  lastName,
}: {
  firstName: string;
  lastName: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] py-0.5 pl-0.5 pr-2.5">
      <Link
        href="/dashboard/settings?tab=profile"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-[11px] font-semibold text-white ring-1 ring-white/20 transition-colors duration-fluid-subtle ease-in-out hover:bg-white/22 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
        aria-label="Mon profil"
        title={`${firstName} ${lastName}`}
      >
        {initials(firstName, lastName)}
      </Link>
      <ShellAgencySwitcher />
    </div>
  );
}

export default function TopBar() {
  const pathname = usePathname();
  const title = titleForPath(pathname);
  const { profile } = useUser();
  const { startTour } = useDashboardTour();

  return (
    <header
      className="relative z-10 flex min-h-[80px] flex-shrink-0 flex-col max-md:border-b max-md:border-black/[0.06] max-md:backdrop-blur-xl max-md:bg-[rgba(249,250,255,0.78)] md:min-h-[56px] md:bg-transparent"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      {/* Même gouttière que main (md:p-3 / lg:p-4) : la recherche s’aligne sur la carte workspace. */}
      <div className="flex min-h-[80px] items-center gap-4 px-4 md:min-h-[56px] md:px-3 lg:px-4">
        <div className="flex min-w-0 shrink-0 items-center gap-2 md:hidden">
          <span
            className="min-w-0 truncate font-bold tracking-tight text-ink"
            style={{ fontSize: 19, letterSpacing: '-0.02em', lineHeight: 1.2 }}
          >
            {title}
          </span>
        </div>

        <div className="hidden min-w-0 flex-1 items-center gap-2 md:flex">
          <div className="min-w-0 w-full max-w-md flex-1">
            <AssistantSearchBar tone="shell" />
          </div>
          <AssistantPanel />
          <CreateMenu className="shrink-0" />
        </div>

        <div className="ml-auto flex flex-shrink-0 items-center gap-1 sm:gap-2 md:gap-2">
          <AssistantSearchIconButton className="text-mute md:hidden" />
          <AssistantPanel variant="mobile" className="md:hidden" />
          <a
            href={FOUNDER_WHATSAPP_HREF}
            target="_blank"
            rel="noopener noreferrer"
            data-tour="whatsapp-mobile"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition-colors duration-fluid-subtle ease-in-out hover:bg-black/[0.04] md:hidden md:h-9 md:w-9"
            aria-label="Écrire au fondateur sur WhatsApp"
            title="Écrire au fondateur"
          >
            <WhatsAppIcon size={20} className="text-[#25D366]" />
          </a>

          <button
            type="button"
            onClick={startTour}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-mute transition-colors duration-fluid-subtle ease-in-out hover:bg-black/[0.04] hover:text-ink md:h-9 md:w-9 md:text-[#B8CDE3] md:hover:bg-white/10 md:hover:text-white"
            aria-label="Revoir le guide de prise en main"
            title="Revoir le guide"
          >
            <HelpCircle size={20} strokeWidth={2} aria-hidden />
          </button>

          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <div className="md:hidden">
              <MobileAgencySwitcher />
            </div>
            <div className="hidden md:block">
              <HeaderProfile firstName={profile.first_name} lastName={profile.last_name} />
            </div>
            <Link
              href="/dashboard/settings?tab=profile"
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary-100 font-semibold tabular text-primary-700 transition-colors duration-fluid-subtle ease-in-out hover:bg-primary-200 md:hidden"
              style={{ fontSize: 11 }}
              aria-label="Mon profil"
              title="Mon profil"
            >
              {initials(profile.first_name, profile.last_name)}
            </Link>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 px-4 pb-2 md:hidden">
        <div className="min-w-0 flex-1">
          <AssistantMobileSearchBar />
        </div>
        <CreateMenu compact className="shrink-0" />
      </div>
    </header>
  );
}
