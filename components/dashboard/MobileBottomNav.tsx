'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRef } from 'react';
import { Building2, CalendarCheck, Map, Mic, Square, Settings, Target, Users } from 'lucide-react';
import { useDevice } from '@/components/dashboard/device/DeviceProvider';
import { useVoiceCapture } from '@/components/dashboard/voice/VoiceCaptureProvider';

const ACTIVE = '#4F46E5';
const INACTIVE = '#64748B';
const ACCENT = '#E8743C';

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
        <Icon size={21} strokeWidth={active ? 2.4 : 2} color={active ? ACTIVE : INACTIVE} aria-hidden />
      </span>
      <span
        className="max-w-full truncate text-center font-semibold"
        style={{ fontSize: 10.5, color: active ? ACTIVE : INACTIVE }}
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
      <TabItem href="/dashboard" label="Aujourd'hui" Icon={CalendarCheck} active={activeToday} />
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
        style={{ fontSize: 12, color: active ? ACCENT : INACTIVE }}
      >
        {label}
      </span>
    </Link>
  );
}

function FieldBottomNav() {
  const pathname = usePathname();
  const {
    beginGestureCapture,
    gestureActive,
    gestureLocked,
    gesturePointerMove,
    gesturePointerUp,
    gesturePointerCancel,
    stopLockedGesture,
  } = useVoiceCapture();
  const activeToday = pathname === '/dashboard' || pathname === '/dashboard/';
  const activeCarte = pathname.startsWith('/dashboard/carte');
  const holdStartYRef = useRef(0);
  const holdStartXRef = useRef(0);

  function onMicPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    if (gestureLocked) {
      e.preventDefault();
      stopLockedGesture();
      return;
    }
    if (gestureActive) return;
    e.preventDefault();
    holdStartYRef.current = e.clientY;
    holdStartXRef.current = e.clientX;
    e.currentTarget.setPointerCapture(e.pointerId);
    beginGestureCapture();
  }

  function onMicPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (!gestureActive || gestureLocked) return;
    const deltaY = holdStartYRef.current - e.clientY;
    const deltaX = e.clientX - holdStartXRef.current;
    gesturePointerMove(deltaY, deltaX);
  }

  function onMicPointerUp(e: React.PointerEvent<HTMLButtonElement>) {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (gestureLocked) return;
    if (gestureActive) gesturePointerUp();
  }

  function onMicPointerCancel(e: React.PointerEvent<HTMLButtonElement>) {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (gestureActive) gesturePointerCancel();
  }

  return (
    <nav
      className="app-tabbar fixed inset-x-2 bottom-0 z-50 rounded-[24px]"
      style={{
        marginBottom: 'max(8px, env(safe-area-inset-bottom))',
        paddingBottom: 6,
      }}
      aria-label="Navigation terrain"
    >
      <div className="relative flex h-14 items-stretch">
        <FieldTab href="/dashboard" label="Aujourd'hui" Icon={CalendarCheck} active={activeToday} />
        <div className="w-16 flex-shrink-0" aria-hidden />
        <FieldTab href="/dashboard/carte" label="Carte" Icon={Map} active={activeCarte} />

        <button
          type="button"
          onPointerDown={onMicPointerDown}
          onPointerMove={onMicPointerMove}
          onPointerUp={onMicPointerUp}
          onPointerCancel={onMicPointerCancel}
          aria-label={
            gestureLocked ? 'Terminer la dictée' : gestureActive ? 'Maintenir pour dicter' : 'Dicter'
          }
          aria-pressed={gestureActive}
          className={`app-press absolute left-1/2 z-10 flex size-16 -translate-x-1/2 touch-none select-none items-center justify-center rounded-full text-white transition-transform duration-150 ${
            gestureActive && !gestureLocked ? 'scale-110' : ''
          } bg-accent`}
          style={{
            top: -12,
            boxShadow: '0 8px 20px rgba(232, 116, 60, 0.38)',
          }}
        >
          {gestureLocked ? (
            <Square size={24} strokeWidth={2.2} aria-hidden />
          ) : (
            <Mic size={26} strokeWidth={2.2} aria-hidden />
          )}
        </button>
      </div>
    </nav>
  );
}

export default function MobileBottomNav() {
  const device = useDevice();
  if (device === 'mobile') return <FieldBottomNav />;
  return <DesktopCompactNav />;
}
