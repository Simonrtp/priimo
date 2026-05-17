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

function TabIcon({ kind, active }: { kind: 'building' | 'user' | 'grid'; active: boolean }) {
  const color = active ? ICON_COLORS.primary : ICON_COLORS.neutral;
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
    <div className="mb-4 flex justify-start gap-8 border-b border-black/[0.08] pb-0">
      {tabs.map(({ id, label, icon }) => {
        const active = value === id;
        const count = counts[id];
        return (
          <button
            key={id}
            type="button"
            onClick={() => onTabChange(id)}
            className={`group relative pb-3 transition-colors duration-150 md:-mb-px ${
              active ? 'font-semibold' : 'font-medium text-[#6B7280] hover:text-ink/80'
            }`}
            style={{
              letterSpacing: '-0.01em',
              ...(active ? { color: ICON_COLORS.primary } : {}),
            }}
          >
            <span className="inline-flex flex-row flex-wrap items-center gap-2">
              <TabIcon kind={icon} active={active} />
              <span className="text-[14px] max-md:text-[13px]">{label}</span>
              <span className="font-medium tabular" style={{ fontSize: 11.5, color: '#9CA3AF' }}>
                ({count})
              </span>
            </span>
            <span
              className="absolute left-0 right-0 bottom-0 h-[2px] rounded-full pointer-events-none"
              style={{ backgroundColor: active ? '#E8743C' : 'transparent' }}
            />
          </button>
        );
      })}
    </div>
  );
}
