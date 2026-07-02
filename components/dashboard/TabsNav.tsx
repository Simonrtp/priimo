'use client';

import type { LeadSegmentTab } from '@/types/lead';
import { ICONS, ICON_COLORS, ICON_SIZE } from '@/lib/iconMapping';

export interface TabsNavProps {
  value: LeadSegmentTab;
  onTabChange: (v: LeadSegmentTab) => void;
  counts: { tous: number; entreprises: number; particuliers: number };
}

const tabs: {
  id: LeadSegmentTab;
  label: string;
  icon: 'building' | 'user' | 'grid';
}[] = [
  { id: 'entreprises', label: 'Entreprises', icon: 'building' },
  { id: 'particuliers', label: 'Particuliers', icon: 'user' },
  { id: 'tous', label: 'Tous', icon: 'grid' },
];

// Tokens de la charte (color accepte une var CSS) — accent indigo du dashboard agence.
const PRIMARY_600 = 'var(--primary-600)';
const PRIMARY_500 = 'var(--primary-500)';

function TabIcon({ kind, active }: { kind: 'building' | 'user' | 'grid'; active: boolean }) {
  const color = active ? PRIMARY_600 : ICON_COLORS.neutral;
  const stroke = 2;
  if (kind === 'grid') {
    return <ICONS.layoutGrid className="flex-shrink-0" size={ICON_SIZE.lg} color={color} strokeWidth={stroke} aria-hidden />;
  }
  if (kind === 'building') {
    return <ICONS.building className="flex-shrink-0" size={ICON_SIZE.lg} color={color} strokeWidth={stroke} aria-hidden />;
  }
  return <ICONS.user className="flex-shrink-0" size={ICON_SIZE.lg} color={color} strokeWidth={stroke} aria-hidden />;
}

export default function TabsNav({ value, onTabChange, counts }: TabsNavProps) {
  return (
    <div className="mb-2 border-b border-black/[0.08] md:mb-4">
      <div
        className="grid grid-cols-3 md:flex md:justify-start md:gap-8"
        role="tablist"
        aria-label="Type de prospects"
      >
        {tabs.map(({ id, label, icon }) => {
          const active = value === id;
          const count = counts[id];
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              aria-label={`${label} (${count})`}
              onClick={() => onTabChange(id)}
              className={`group relative flex min-h-[44px] flex-col items-center justify-center gap-0.5 px-1 pb-3 transition-colors duration-150 md:-mb-px md:min-h-0 md:flex-row md:items-center md:gap-2 md:px-0 md:pb-3 ${
                active ? 'font-semibold' : 'font-medium text-[#6B7280] hover:text-ink/80'
              }`}
              style={{
                letterSpacing: '-0.01em',
                ...(active ? { color: PRIMARY_600 } : {}),
              }}
            >
              <TabIcon kind={icon} active={active} />
              <span className="hidden text-[14px] md:inline">{label}</span>
              <span
                className="font-medium tabular text-[10px] md:text-[11.5px]"
                style={{ color: '#9CA3AF' }}
              >
                ({count})
              </span>
              <span
                className="pointer-events-none absolute bottom-0 left-2 right-2 h-[2px] rounded-full md:left-0 md:right-0"
                style={{ backgroundColor: active ? PRIMARY_500 : 'transparent' }}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
