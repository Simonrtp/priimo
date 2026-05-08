'use client';

import { usePathname } from 'next/navigation';

const pageTitles: Record<string, string> = {
  '/dashboard': 'Mes prospects',
  '/dashboard/settings': 'Paramètres',
};

export default function TopBar() {
  const pathname = usePathname();
  const title = pageTitles[pathname] ?? 'Dashboard';

  return (
    <header
      className="bg-white border-b border-[#E5E5E5] flex items-center justify-between px-8 flex-shrink-0"
      style={{ height: '56px' }}
    >
      <span className="font-semibold text-gray-900" style={{ fontSize: '16px' }}>
        {title}
      </span>
      <div className="flex items-center gap-3">
        <div
          className="rounded-full bg-gray-200 flex items-center justify-center text-gray-700 font-medium"
          style={{ width: '32px', height: '32px', fontSize: '13px' }}
        >
          AT
        </div>
        <span className="text-gray-700 font-medium" style={{ fontSize: '14px' }}>
          Agence Test
        </span>
      </div>
    </header>
  );
}
