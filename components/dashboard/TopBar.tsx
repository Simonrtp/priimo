'use client';

import { usePathname } from 'next/navigation';

const titles: Record<string, string> = {
  '/dashboard':          'Mes prospects',
  '/dashboard/settings': 'Paramètres',
};

export default function TopBar() {
  const pathname = usePathname();
  const title = titles[pathname] ?? 'Dashboard';

  return (
    <header
      className="bg-canvas/80 backdrop-blur-md border-b border-black/8 flex items-center justify-between px-8 flex-shrink-0"
      style={{ height: 56 }}
    >
      <span className="font-semibold text-ink tracking-tight" style={{ fontSize: 15, letterSpacing: '-0.01em' }}>
        {title}
      </span>

      <div className="flex items-center gap-3">
        <div
          className="rounded-full bg-accent/15 text-accent-dark font-semibold flex items-center justify-center tabular"
          style={{ width: 30, height: 30, fontSize: 11 }}
        >
          AT
        </div>
        <span className="text-ink font-medium" style={{ fontSize: 13 }}>
          Agence Test
        </span>
      </div>
    </header>
  );
}
