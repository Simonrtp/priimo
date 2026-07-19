'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { removeCausioWidget } from '@/lib/causio-widget';

/** Retire le chatbot Causio dès qu'on quitte la landing (`/`). */
export default function CausioRouteGuard() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== '/') {
      removeCausioWidget();
    }
  }, [pathname]);

  return null;
}
