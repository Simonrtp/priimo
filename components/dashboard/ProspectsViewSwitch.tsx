'use client';

import { LayoutList, Columns3, Map } from 'lucide-react';
import type { ProspectionVue } from '@/lib/prospection/vue';
import { PASTILLE_TRACK, pastilleClass } from '@/components/ui/pastille-classes';

export type { ProspectionVue } from '@/lib/prospection/vue';
export { parseProspectionVue, prospectionHref, carteVersProspectionHref } from '@/lib/prospection/vue';

const ITEMS: {
  id: ProspectionVue;
  label: string;
  Icon: typeof LayoutList;
}[] = [
  { id: 'carte', label: 'Carte', Icon: Map },
  { id: 'pipeline', label: 'Pipeline', Icon: Columns3 },
  { id: 'liste', label: 'Liste', Icon: LayoutList },
];

export default function ProspectsViewSwitch({
  value,
  onChange,
  variant = 'default',
}: {
  value: ProspectionVue;
  onChange: (vue: ProspectionVue) => void;
  /** Sur la carte : style glass comme le bouton Couches. */
  variant?: 'default' | 'floating' | 'bar';
}) {
  const floating = variant === 'floating';
  const bar = variant === 'bar';
  const shellClass = floating
    ? // Onglet collé coin haut-droit de la carte (pas de marge).
      'flex rounded-bl-[20px] rounded-tr-[32px] border-0 bg-white p-1 pl-1.5 pt-1.5 shadow-[0_8px_20px_-10px_rgba(26,42,86,0.28)]'
    : bar
      ? 'flex w-fit rounded-full border border-black/[0.08] bg-white p-0.5 shadow-sm'
      : PASTILLE_TRACK;

  return (
    <div className={`${shellClass} overflow-visible`} role="tablist" aria-label="Vue prospection">
      {ITEMS.map(({ id, label, Icon }) => {
        const active = value === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={label}
            title={label}
            data-prospection-vue={id}
            onClick={() => onChange(id)}
            className={`inline-flex items-center justify-center font-semibold transition-colors duration-fluid-subtle ease-in-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
              bar
                ? `size-9 rounded-full ${
                    active ? 'bg-surface text-text-strong shadow-clay-sm' : 'text-text-muted hover:text-text'
                  }`
                : floating
                  ? `gap-1.5 rounded-full px-3 py-2 text-[13px] ${
                      active
                        ? 'bg-[#1A2A56] text-white shadow-sm'
                        : 'text-text-muted hover:bg-black/[0.04] hover:text-text'
                    }`
                  : `gap-1 sm:gap-1.5 ${pastilleClass(active)}`
            }`}
          >
            <Icon size={bar ? 16 : 14} strokeWidth={2.2} aria-hidden />
            {bar ? null : <span>{label}</span>}
          </button>
        );
      })}
    </div>
  );
}
