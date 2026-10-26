'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Le contenu arrive en fondu à chaque page. Changer d’onglet (Carte / Liste /
 * Pipeline) ou ouvrir un filtre ne relance pas le fondu : la barre d’onglets
 * reste collée, sans saut.
 */
export default function FonduPage({ children }: { children: ReactNode }) {
  const path = usePathname();

  return (
    <div key={path} className="page-douce flex min-h-0 min-w-0 flex-1 flex-col">
      {children}
    </div>
  );
}
