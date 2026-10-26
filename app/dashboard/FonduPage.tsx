'use client';

import type { ReactNode } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

/**
 * Le contenu arrive en fondu à chaque page, et à chaque vue de prospection.
 * Un filtre ou une annonce ouverte ne relance pas le fondu.
 */
export default function FonduPage({ children }: { children: ReactNode }) {
  const path = usePathname();
  const vue = useSearchParams().get('vue');
  const cle = path.startsWith('/dashboard/prospection') ? `${path}:${vue ?? 'carte'}` : path;

  return (
    <div key={cle} className="page-douce flex min-h-0 min-w-0 flex-1 flex-col">
      {children}
    </div>
  );
}
