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
    <>
      {/* Mobile : segmented control (pilule) façon iOS */}
      <div
        className="mb-3 flex gap-1 rounded-2xl bg-black/[0.05] p-1 shadow-clay-inset md:hidden"
        role="tablist"
        aria-label="Type de prospects"
      >
        {tabs.map(({ id, label }) => {
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
              className={`app-press flex min-h-[40px] flex-1 items-center justify-center gap-1 rounded-[13px] px-1.5 text-[13px] transition-colors duration-200 ${
                active ? 'bg-surface font-semibold text-primary-600 shadow-clay-sm' : 'font-medium text-text-muted'
              }`}
              style={{ letterSpacing: '-0.01em' }}
            >
              <span className="truncate">{label}</span>
              <span
                className={`tabular text-[11px] ${active ? 'text-primary-400' : 'text-text-subtle'}`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Desktop : onglets soulignés */}
      <div className="mb-2 hidden border-b border-black/[0.08] md:mb-4 md:block">
        <div className="flex justify-start gap-8" role="tablist" aria-label="Type de prospects">
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
                className={`group relative -mb-px flex min-h-0 flex-row items-center gap-2 px-0 pb-3 transition-colors duration-150 ${
                  active ? 'font-semibold' : 'font-medium text-[#6B7280] hover:text-ink/80'
                }`}
                style={{
                  letterSpacing: '-0.01em',
                  ...(active ? { color: PRIMARY_600 } : {}),
                }}
              >
                <TabIcon kind={icon} active={active} />
                <span className="text-[14px]">{label}</span>
                <span className="font-medium tabular text-[11.5px]" style={{ color: '#9CA3AF' }}>
                  ({count})
                </span>
                <span
                  className="pointer-events-none absolute bottom-0 left-0 right-0 h-[2px] rounded-full"
                  style={{ backgroundColor: active ? PRIMARY_500 : 'transparent' }}
                />
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
