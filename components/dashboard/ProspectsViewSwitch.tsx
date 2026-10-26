'use client';

import type { ReactNode } from 'react';
import type { ProspectionVue } from '@/lib/prospection/vue';
import { PASTILLE_TRACK, pastilleClass } from '@/components/ui/pastille-classes';

export type { ProspectionVue } from '@/lib/prospection/vue';
export { parseProspectionVue, prospectionHref, carteVersProspectionHref } from '@/lib/prospection/vue';

const ITEMS: { id: ProspectionVue; label: string }[] = [
  { id: 'carte', label: 'Carte' },
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'liste', label: 'Liste' },
];

export default function ProspectsViewSwitch({
  value,
  onChange,
  debut = null,
}: {
  value: ProspectionVue;
  onChange: (vue: ProspectionVue) => void;
  /** Conservé pour les appelants. Toutes les variantes partagent la même pastille. */
  variant?: 'default' | 'floating' | 'bar';
  /** Dans le même onglet, avant « Carte » : la recherche d'adresse de la carte. */
  debut?: ReactNode;
}) {
  return (
    <div className="flex max-w-full items-center">
      {debut}
      <div className={PASTILLE_TRACK} role="tablist" aria-label="Vue prospection">
        {ITEMS.map(({ id, label }) => {
          const active = value === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              aria-label={label}
              data-prospection-vue={id}
              onClick={() => onChange(id)}
              className={pastilleClass(active)}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
