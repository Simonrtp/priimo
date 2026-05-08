'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MapPin, Settings } from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: 'Prospects', icon: MapPin },
  { href: '/dashboard/settings', label: 'Paramètres', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="h-screen bg-white border-r border-[#E5E5E5] flex flex-col flex-shrink-0"
      style={{ width: '220px' }}
    >
      <div className="px-4 pt-6 pb-4">
        <div className="mb-8">
          <span className="font-bold text-[#2563EB]" style={{ fontSize: '22px' }}>
            Priimo
          </span>
        </div>

        <nav className="flex flex-col gap-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 rounded-[6px] transition-colors duration-150 ${
                  isActive
                    ? 'bg-blue-50 text-blue-600 font-semibold'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
                style={{ padding: '10px 12px', fontSize: '14px', fontWeight: isActive ? 600 : 500 }}
              >
                <Icon size={18} />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto px-4 py-4 border-t border-[#E5E5E5]">
        <p className="text-gray-500" style={{ fontSize: '12px' }}>
          Plan Fondateur
        </p>
        <p className="text-gray-900 font-medium" style={{ fontSize: '14px' }}>
          Agence Test
        </p>
      </div>
    </aside>
  );
}
