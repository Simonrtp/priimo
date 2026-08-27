'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarCheck, Ellipsis, Map, Settings, Target, Building2, Users } from 'lucide-react';
import CreateMenu from '@/components/dashboard/create/CreateMenu';
import { useDevice } from '@/components/dashboard/device/DeviceProvider';
import FieldPlusSheet from '@/components/dashboard/field/FieldPlusSheet';
import { useOfflineQueue } from '@/components/dashboard/field/OfflineQueueProvider';
import { FIELD } from '@/lib/today/field';

const INACTIVE = '#64748B';
const ACCENT = FIELD.orange;

function TabItem({
  href,
  label,
  Icon,
  active,
}: {
  href: string;
  label: string;
  Icon: typeof Target;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className="app-press flex min-w-0 flex-1 flex-col items-center justify-center gap-1 pt-1.5"
    >
      <span
        className={`flex h-8 w-full max-w-[52px] items-center justify-center rounded-full transition-colors duration-200 ${
          active ? 'bg-primary-100' : 'bg-transparent'
        }`}
      >
        <Icon size={21} strokeWidth={active ? 2.4 : 2} color={active ? '#4F46E5' : INACTIVE} aria-hidden />
      </span>
      <span
        className="max-w-full truncate text-center font-semibold"
        style={{ fontSize: 10.5, color: active ? '#4F46E5' : INACTIVE }}
      >
        {label}
      </span>
    </Link>
  );
}

function DesktopCompactNav() {
  const pathname = usePathname();

  const activeToday = pathname === '/dashboard' || pathname === '/dashboard/';
  const activeCarte = pathname.startsWith('/dashboard/carte');
  const activeProspects = pathname.startsWith('/dashboard/prospection');
  const activeContacts = pathname.startsWith('/dashboard/contacts');
  const activeBiens = pathname.startsWith('/dashboard/biens');
  const activeSettings =
    pathname === '/dashboard/settings' ||
    pathname.startsWith('/dashboard/settings/') ||
    pathname.startsWith('/dashboard/parametres');

  return (
    <nav
      className="app-tabbar fixed inset-x-2 bottom-0 z-50 flex rounded-[26px] px-1 pt-1 md:hidden"
      style={{
        marginBottom: 'max(8px, env(safe-area-inset-bottom))',
        paddingBottom: 8,
      }}
      aria-label="Navigation mobile"
    >
      <TabItem href="/dashboard" label="Accueil" Icon={CalendarCheck} active={activeToday} />
      <TabItem href="/dashboard/prospection" label="Prospects" Icon={Target} active={activeProspects} />
      <TabItem href="/dashboard/carte" label="Carte" Icon={Map} active={activeCarte} />
      <TabItem href="/dashboard/contacts" label="Contacts" Icon={Users} active={activeContacts} />
      <TabItem href="/dashboard/biens" label="Biens" Icon={Building2} active={activeBiens} />
      <TabItem href="/dashboard/settings" label="Paramètres" Icon={Settings} active={activeSettings} />
    </nav>
  );
}

function FieldTab({
  href,
  label,
  Icon,
  active,
}: {
  href: string;
  label: string;
  Icon: typeof Map;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className="app-press flex min-h-[44px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1"
    >
      <Icon
        size={22}
        strokeWidth={active ? 2.4 : 2}
        color={active ? ACCENT : INACTIVE}
        aria-hidden
      />
      <span
        className="text-center font-semibold"
        style={{ fontSize: 11.5, color: active ? ACCENT : INACTIVE }}
      >
        {label}
      </span>
    </Link>
  );
}

function FieldBottomNav() {
  const pathname = usePathname();
  const { pending } = useOfflineQueue();
  const [plusOpen, setPlusOpen] = useState(false);

  const activeToday = pathname === '/dashboard' || pathname === '/dashboard/';
  const activeCarte = pathname.startsWith('/dashboard/carte');
  const activeTournee = pathname.startsWith('/dashboard/tournee');
  const activePlus =
    plusOpen ||
    pathname.startsWith('/dashboard/prospection') ||
    pathname.startsWith('/dashboard/contacts') ||
    pathname.startsWith('/dashboard/biens') ||
    pathname.startsWith('/dashboard/settings');

  const hideSideTabs = activeTournee;

  return (
    <>
      <nav
        className="app-tabbar fixed inset-x-2 bottom-0 z-50 rounded-[24px]"
        style={{
          marginBottom: 'max(8px, env(safe-area-inset-bottom))',
          paddingBottom: 6,
        }}
        aria-label="Navigation terrain"
      >
        <div className="relative flex h-14 items-stretch">
          {hideSideTabs ? (
            <>
              <div className="flex-1" aria-hidden />
              <div className="relative w-16 flex-shrink-0">
                <div
                  className="absolute left-1/2 z-10 -translate-x-1/2"
                  style={{ top: -12 }}
                >
                  <CreateMenu variant="fab" />
                </div>
              </div>
              <div className="flex-1" aria-hidden />
            </>
          ) : (
            <>
              <FieldTab href="/dashboard" label="Accueil" Icon={CalendarCheck} active={activeToday} />
              <div className="relative w-16 flex-shrink-0">
                <div
                  className="absolute left-1/2 z-10 -translate-x-1/2"
                  style={{ top: -12 }}
                >
                  <CreateMenu variant="fab" />
                </div>
              </div>
              <FieldTab href="/dashboard/carte" label="Carte" Icon={Map} active={activeCarte} />
              <button
                type="button"
                onClick={() => setPlusOpen(true)}
                aria-label="Plus"
                aria-expanded={plusOpen}
                className="app-press relative flex min-h-[44px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1"
              >
                <Ellipsis
                  size={22}
                  strokeWidth={activePlus ? 2.4 : 2}
                  color={activePlus ? ACCENT : INACTIVE}
                  aria-hidden
                />
                <span
                  className="text-center font-semibold"
                  style={{ fontSize: 11.5, color: activePlus ? ACCENT : INACTIVE }}
                >
                  Plus
                </span>
                {pending > 0 ? (
                  <span
                    className="absolute right-2 top-1 size-2 rounded-full"
                    style={{ backgroundColor: FIELD.orange }}
                    aria-label={`${pending} action${pending > 1 ? 's' : ''} en attente`}
                  />
                ) : null}
              </button>
            </>
          )}
        </div>
      </nav>
      <FieldPlusSheet open={plusOpen} onClose={() => setPlusOpen(false)} />
    </>
  );
}

export default function MobileBottomNav() {
  const device = useDevice();
  if (device === 'mobile') return <FieldBottomNav />;
  return <DesktopCompactNav />;
}
