'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useSqueletteEnAttente } from '@/components/dashboard/navigation/NavigationInstantanee';
import { cleEmplacement } from '@/lib/navigation/cible';
import SqueletteDeRoute from './_navigation/SqueletteDeRoute';

/**
 * Le contenu arrive en fondu à chaque page. Changer d’onglet (Carte / Liste /
 * Pipeline) ou ouvrir un filtre ne relance pas le fondu : la barre d’onglets
 * reste collée, sans saut.
 *
 * Un clic vers un autre écran le remplace aussitôt par le squelette de
 * l'écran demandé : on ne reste jamais sur l'ancienne page à attendre.
 * L'ancienne page est démontée, pas cachée : cachée, elle garderait la mise
 * en page de la carte (`:has([data-prospection-carte])`).
 */
export default function FonduPage({ children }: { children: ReactNode }) {
  const path = usePathname();
  const squelette = useSqueletteEnAttente();

  if (squelette) {
    return (
      <div key={`attente:${cleEmplacement(squelette)}`} className="page-douce flex min-h-0 min-w-0 flex-1 flex-col">
        <SqueletteDeRoute vers={squelette} />
      </div>
    );
  }

  return (
    <div key={path} className="page-douce flex min-h-0 min-w-0 flex-1 flex-col">
      {children}
    </div>
  );
}
