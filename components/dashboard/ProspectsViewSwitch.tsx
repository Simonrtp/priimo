'use client';

import { LayoutList, Columns3, Map } from 'lucide-react';

export type ProspectionVue = 'liste' | 'pipeline' | 'carte';

export function parseProspectionVue(raw: string | undefined | null): ProspectionVue {
  if (raw === 'pipeline' || raw === 'carte') return raw;
  return 'liste';
}

export function prospectionHref(current: URLSearchParams, vue: ProspectionVue): string {
  const params = new URLSearchParams(current.toString());
  if (vue === 'liste') params.delete('vue');
  else params.set('vue', vue);
  const q = params.toString();
  return q ? `/dashboard/prospection?${q}` : '/dashboard/prospection';
}

const ITEMS: {
  id: ProspectionVue;
  label: string;
  Icon: typeof Map;
  desktopOnly?: boolean;
}[] = [
  { id: 'liste', label: 'Liste', Icon: LayoutList },
  { id: 'pipeline', label: 'Pipeline', Icon: Columns3, desktopOnly: true },
  { id: 'carte', label: 'Carte', Icon: Map },
];

export default function ProspectsViewSwitch({
  value,
  onChange,
}: {
  value: ProspectionVue;
  onChange: (vue: ProspectionVue) => void;
}) {
  return (
    <div
      className="flex rounded-xl bg-black/[0.05] p-0.5 shadow-clay-inset"
      role="tablist"
      aria-label="Vue prospection"
    >
      {ITEMS.map(({ id, label, Icon, desktopOnly }) => {
        const active = value === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={label}
            onClick={() => onChange(id)}
            className={`${desktopOnly ? 'hidden md:inline-flex' : 'inline-flex'} min-h-[36px] items-center gap-1.5 rounded-[10px] px-2.5 text-[12.5px] font-semibold transition-colors duration-150 md:px-3 ${
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
