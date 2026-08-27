'use client';

import { usePathname } from 'next/navigation';
import {
  Building2,
  CalendarCheck,
  Settings,
  Target,
  Users,
  type LucideIcon,
} from 'lucide-react';

/**
 * Fond workspace : icône watermark à peine visible sur fond unicolore.
 */

type Variant = 'today' | 'prospection' | 'contacts' | 'biens' | 'settings';

function variantForPath(pathname: string): Variant {
  if (pathname.startsWith('/dashboard/prospection')) return 'prospection';
  if (pathname.startsWith('/dashboard/estimation')) return 'prospection';
  if (pathname.startsWith('/dashboard/contacts')) return 'contacts';
  if (pathname.startsWith('/dashboard/biens')) return 'biens';
  if (pathname.startsWith('/dashboard/settings')) return 'settings';
  if (pathname.startsWith('/dashboard/parametres')) return 'settings';
  return 'today';
}

const ICONS: Record<Variant, LucideIcon> = {
  today: CalendarCheck,
  prospection: Target,
  contacts: Users,
  biens: Building2,
  settings: Settings,
};

export default function WorkspaceBackdrop() {
  const pathname = usePathname();
  if (pathname === '/dashboard' || pathname === '/dashboard/') return null;
  if (pathname.startsWith('/dashboard/contacts')) return null;
  const Icon = ICONS[variantForPath(pathname)];

  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      <div className="absolute inset-0 flex items-center justify-center">
        <Icon
          className="size-[min(68vh,560px)] text-blue-light"
          strokeWidth={1}
          style={{ opacity: 0.07 }}
          aria-hidden
        />
      </div>
    </div>
  );
}
