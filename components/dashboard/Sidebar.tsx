'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MapPin, Settings } from 'lucide-react';

const nav = [
  { href: '/dashboard',          label: 'Prospects',   Icon: MapPin   },
  { href: '/dashboard/settings', label: 'Paramètres',  Icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="h-screen bg-canvas border-r border-black/8 flex flex-col flex-shrink-0"
      style={{ width: 232 }}
    >
      {/* Logo */}
      <div className="px-5 pt-6 pb-2">
        <span
          className="font-bold tracking-tight text-accent-dark"
          style={{ fontSize: 22, letterSpacing: '-0.03em' }}
        >
          Priimo
        </span>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-0.5 px-3 pt-4 flex-1">
        {nav.map(({ href, label, Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors duration-150 ${
                active
                  ? 'bg-accent/10 text-accent-dark font-semibold'
                  : 'text-mute hover:bg-black/[0.04] hover:text-ink font-medium'
              }`}
              style={{ fontSize: 13.5 }}
            >
              <Icon size={16} strokeWidth={active ? 2.2 : 1.8} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Agency footer */}
      <div className="mx-3 mb-4 rounded-xl bg-soft-warm px-4 py-3">
        <p className="text-mute tabular" style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          Plan Fondateur
        </p>
        <p className="font-semibold text-ink mt-0.5" style={{ fontSize: 13 }}>
          Agence Test
        </p>
      </div>
    </aside>
  );
}
