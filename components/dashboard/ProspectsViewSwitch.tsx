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
  { id: 'liste', label: 'Liste', Icon: LayoutList },
  { id: 'pipeline', label: 'Pipeline', Icon: Columns3 },
];

export default function ProspectsViewSwitch({
  value,
  onChange,
  variant = 'default',
}: {
  value: ProspectionVue;
  onChange: (vue: ProspectionVue) => void;
  /** Sur la carte : style glass comme le bouton Couches. */
  variant?: 'default' | 'floating';
}) {
  const shellClass =
    variant === 'floating'
      ? 'flex rounded-clay border border-black/[0.08] bg-surface/95 p-0.5 shadow-clay-sm backdrop-blur-sm'
      : 'flex rounded-xl bg-black/[0.05] p-0.5 shadow-clay-inset';

  return (
    <div className={shellClass} role="tablist" aria-label="Vue prospection">
      {ITEMS.map(({ id, label, Icon }) => {
        const active = value === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={label}
            onClick={() => onChange(id)}
            className={`inline-flex min-h-[36px] items-center gap-1 rounded-[10px] px-2 text-[12px] font-semibold transition-colors duration-fluid-subtle ease-in-out sm:gap-1.5 sm:px-2.5 sm:text-[12.5px] md:px-3 ${
              active ? 'bg-surface text-text-strong shadow-clay-sm' : 'text-text-muted hover:text-text'
            }`}
          >
            <Icon size={14} strokeWidth={2.2} aria-hidden />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
