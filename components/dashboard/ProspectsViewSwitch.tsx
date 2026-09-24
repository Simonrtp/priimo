'use client';

import { LayoutList, Columns3, Map } from 'lucide-react';
import type { ProspectionVue } from '@/lib/prospection/vue';

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
  const bar = variant === 'bar';
  const shellClass =
    variant === 'floating'
      ? 'flex rounded-clay border border-black/[0.08] bg-surface/95 p-0.5 shadow-clay-sm backdrop-blur-sm'
      : bar
        ? 'flex w-fit rounded-full border border-black/[0.08] bg-white p-0.5 shadow-sm'
        : 'flex rounded-xl bg-black/[0.05] p-0.5 shadow-clay-inset';

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
                ? 'size-9 rounded-full'
                : 'min-h-[36px] gap-1 rounded-[10px] px-2 text-[12px] sm:gap-1.5 sm:px-2.5 sm:text-[12.5px] md:px-3'
            } ${
              active ? 'bg-surface text-text-strong shadow-clay-sm' : 'text-text-muted hover:text-text'
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
