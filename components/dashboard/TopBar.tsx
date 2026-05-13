'use client';

import { usePathname } from 'next/navigation';

function titleForPath(pathname: string): string {
  if (pathname === '/dashboard/overview' || pathname.startsWith('/dashboard/overview/')) {
    return 'Tableau de bord';
  }
  if (pathname === '/dashboard' || pathname === '/dashboard/') {
    return 'Mes prospects';
  }
  if (pathname === '/dashboard/territory' || pathname.startsWith('/dashboard/territory/')) {
    return 'Mon territoire';
  }
  if (pathname === '/dashboard/settings' || pathname.startsWith('/dashboard/settings/')) {
    return 'Paramètres';
  }
  return 'Dashboard';
}

export default function TopBar() {
  const pathname = usePathname();
  const title = titleForPath(pathname);

  return (
    <header
      className="flex flex-shrink-0 items-center justify-between border-b border-black/8 bg-canvas/80 px-4 backdrop-blur-md md:px-8"
      style={{ height: undefined }}
    >
      <span
        className="font-semibold tracking-tight text-ink max-md:text-[15px] md:py-0"
        style={{ fontSize: 15, letterSpacing: '-0.01em', lineHeight: '48px' }}
      >
        {title === 'Mes prospects' ? 'Prospects' : title}
      </span>

      <div className="flex items-center gap-3 max-md:gap-0">
        <div
          className="hidden items-center gap-3 md:flex"
        >
          <div
            className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-accent/15 text-accent-dark font-semibold tabular"
            style={{ fontSize: 11 }}
          >
            AT
          </div>
          <span className="text-ink font-medium" style={{ fontSize: 13 }}>
            Agence Test
          </span>
        </div>
        <div
          className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/15 text-accent-dark font-semibold tabular md:hidden"
          style={{ fontSize: 11 }}
          aria-hidden
        >
          AT
        </div>
      </div>
    </header>
  );
}
