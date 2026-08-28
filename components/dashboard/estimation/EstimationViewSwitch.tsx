'use client';

import { Calculator, Globe } from 'lucide-react';
import type { EstimationVue } from '@/lib/estimation/vue';

export type { EstimationVue } from '@/lib/estimation/vue';
export { parseEstimationVue, estimationHref } from '@/lib/estimation/vue';

const ITEMS: { id: EstimationVue; label: string; Icon: typeof Calculator }[] = [
  { id: 'outil', label: 'Estimer', Icon: Calculator },
  { id: 'widget', label: 'Widget site', Icon: Globe },
];

export default function EstimationViewSwitch({
  value,
  onChange,
}: {
  value: EstimationVue;
  onChange: (vue: EstimationVue) => void;
}) {
  return (
    <div
      className="flex rounded-xl bg-black/[0.05] p-0.5 shadow-clay-inset"
      role="tablist"
      aria-label="Vue estimation"
    >
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
            className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-[10px] px-2.5 text-[12.5px] font-semibold transition-colors duration-fluid-subtle ease-in-out md:px-3 ${
              active ? 'bg-surface text-text-strong shadow-clay-sm' : 'text-text-muted hover:text-text'
            }`}
          >
            <Icon size={14} strokeWidth={2.2} aria-hidden />
            <span className="hidden sm:inline">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
