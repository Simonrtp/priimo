'use client';

import { Moon, Sun, SunMoon, Sunrise, Sunset, type LucideIcon } from 'lucide-react';
import { PASTILLE_TRACK, pastilleClass } from '@/components/ui/pastille-classes';
import { definirLumiere, LIBELLES_LUMIERE, useChoixLumiere, type ChoixLumiere as Choix } from '@/lib/map/lumiere';

const OPTIONS: { valeur: Choix; icone: LucideIcon; aide: string }[] = [
  { valeur: 'auto', icone: SunMoon, aide: 'Auto : suit le soleil au-dessus de la carte' },
  { valeur: 'dawn', icone: Sunrise, aide: 'Aube' },
  { valeur: 'day', icone: Sun, aide: 'Jour' },
  { valeur: 'dusk', icone: Sunset, aide: 'Crépuscule' },
  { valeur: 'night', icone: Moon, aide: 'Nuit' },
];

/**
 * La lumière de la carte (fond Standard) : automatique selon le soleil, ou
 * fixée par l'agent. Le choix vaut pour toutes ses cartes, sur cet appareil.
 */
export default function ChoixLumiere() {
  const choix = useChoixLumiere();
  return (
    <li className="mb-1.5">
      <p className="mb-1 px-0.5 text-[11.5px] font-medium text-text-subtle">
        Lumière <span className="text-text-muted">· {LIBELLES_LUMIERE[choix]}</span>
      </p>
      <div role="radiogroup" aria-label="Lumière de la carte" className={`${PASTILLE_TRACK} w-full`}>
        {OPTIONS.map(({ valeur, icone: Icone, aide }) => {
          const actif = choix === valeur;
          return (
            <button
              key={valeur}
              type="button"
              role="radio"
              aria-checked={actif}
              aria-label={aide}
              title={aide}
              onClick={() => definirLumiere(valeur)}
              className={`${pastilleClass(actif)} inline-flex min-w-0 flex-1 items-center justify-center`}
            >
              <Icone size={15} strokeWidth={2.2} aria-hidden className="shrink-0" />
            </button>
          );
        })}
      </div>
    </li>
  );
}
