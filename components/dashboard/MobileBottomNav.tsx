'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HelpCircle, Settings, Target } from 'lucide-react';

const ACCENT = '#E8743C';
const INACTIVE = '#6B7280';

function matchProspects(p: string) {
  return p === '/dashboard' || p === '/dashboard/';
}

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
      className="flex min-h-[44px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 pt-1"
      style={{ paddingBottom: 'max(4px, env(safe-area-inset-bottom))' }}
    >
      <Icon size={24} strokeWidth={2} color={active ? ACCENT : INACTIVE} aria-hidden />
      <span
        className="max-w-full truncate text-center font-medium"
        style={{ fontSize: 11, color: active ? ACCENT : INACTIVE }}
      >
        {label}
      </span>
    </Link>
  );
}

function HelpTab() {
  return (
    <a
      href="mailto:support@priimo.fr"
      className="flex min-h-[44px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 pt-1 text-inherit no-underline"
      style={{ paddingBottom: 'max(4px, env(safe-area-inset-bottom))' }}
      aria-label="Aide et support — écrire à support@priimo.fr"
    >
      <HelpCircle size={24} strokeWidth={2} color={INACTIVE} aria-hidden />
      <span className="max-w-full truncate text-center font-medium" style={{ fontSize: 11, color: INACTIVE }}>
        Aide
      </span>
    </a>
  );
}

export default function MobileBottomNav() {
  const pathname = usePathname();

  const activeProspects = matchProspects(pathname);
  const activeSettings =
    pathname === '/dashboard/settings' || pathname.startsWith('/dashboard/settings/');

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex border-t border-gray-200 bg-white md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      aria-label="Navigation mobile"
    >
      <TabItem href="/dashboard" label="Prospects" Icon={Target} active={activeProspects} />
      <TabItem href="/dashboard/settings" label="Paramètres" Icon={Settings} active={activeSettings} />
      <HelpTab />
    </nav>
  );
}
