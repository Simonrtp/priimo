'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Settings, Target } from 'lucide-react';
import WhatsAppIcon from '@/components/icons/WhatsAppIcon';
import { FOUNDER_WHATSAPP_HREF } from '@/lib/founder-contact';

// Tab bar mobile façon app native : barre flottante translucide, pastille
// active indigo (charte clay), retour tactile. Desktop : masquée (md:hidden).
const ACTIVE = '#4F46E5'; // primary-600
const INACTIVE = '#64748B'; // text-muted

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
        className={`flex h-8 w-[52px] items-center justify-center rounded-full transition-colors duration-200 ${
          active ? 'bg-primary-100' : 'bg-transparent'
        }`}
      >
        <Icon size={22} strokeWidth={active ? 2.4 : 2} color={active ? ACTIVE : INACTIVE} aria-hidden />
      </span>
      <span
        className="max-w-full truncate text-center font-semibold"
        style={{ fontSize: 11, color: active ? ACTIVE : INACTIVE, letterSpacing: '-0.01em' }}
      >
        {label}
      </span>
    </Link>
  );
}

function HelpTab() {
  return (
    <a
      href={FOUNDER_WHATSAPP_HREF}
      target="_blank"
      rel="noopener noreferrer"
      className="app-press flex min-w-0 flex-1 flex-col items-center justify-center gap-1 pt-1.5 text-inherit no-underline"
      aria-label="Écrire au fondateur sur WhatsApp"
    >
      <span className="flex h-8 w-[52px] items-center justify-center rounded-full">
        <WhatsAppIcon size={22} className="text-[#25D366]" />
      </span>
      <span className="max-w-full truncate text-center font-semibold" style={{ fontSize: 11, color: INACTIVE, letterSpacing: '-0.01em' }}>
        Fondateur
      </span>
    </a>
  );
}

export default function MobileBottomNav() {
  const pathname = usePathname();

  const activeProspects = pathname === '/dashboard' || pathname === '/dashboard/';
  const activeSettings =
    pathname === '/dashboard/settings' || pathname.startsWith('/dashboard/settings/');

  return (
    <nav
      className="app-tabbar fixed inset-x-3 bottom-0 z-50 flex rounded-[26px] px-1.5 pt-1 md:hidden"
      style={{
        marginBottom: 'max(8px, env(safe-area-inset-bottom))',
        paddingBottom: 8,
      }}
      aria-label="Navigation mobile"
    >
      <TabItem href="/dashboard" label="Prospects" Icon={Target} active={activeProspects} />
      <TabItem href="/dashboard/settings" label="Paramètres" Icon={Settings} active={activeSettings} />
      <HelpTab />
    </nav>
  );
}
