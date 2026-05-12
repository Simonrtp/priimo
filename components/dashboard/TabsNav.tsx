'use client';

import type { LeadSegmentTab } from '@/types/lead';
import { ICONS, ICON_COLORS, ICON_SIZE } from '@/lib/iconMapping';

export interface TabsNavProps {
  value: LeadSegmentTab;
  onTabAttempt: (v: LeadSegmentTab) => void;
  counts: { tous: number; entreprises: number; particuliers: number };
  isPremium: boolean;
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
    return (
      <ICONS.layoutGrid
        className="flex-shrink-0"
        size={ICON_SIZE.lg}
        color={color}
        strokeWidth={stroke}
        aria-hidden
      />
    );
  }
  if (kind === 'building') {
    return (
      <ICONS.building
        className="flex-shrink-0"
        size={ICON_SIZE.lg}
        color={color}
        strokeWidth={stroke}
        aria-hidden
      />
    );
  }
  return (
    <ICONS.user
      className="flex-shrink-0"
      size={ICON_SIZE.lg}
      color={color}
      strokeWidth={stroke}
      aria-hidden
    />
  );
}

/** Onglets Entreprises / Particuliers / Tous (soulignement, compteurs, gating Premium). */
export default function TabsNav({ value, onTabAttempt, counts, isPremium }: TabsNavProps) {
  return (
    <div className="flex gap-10 mb-4 border-b border-black/[0.08]">
      {tabs.map(({ id, label, icon }) => {
        const active = value === id;
        const count = counts[id];
        const isEnterpriseTab = id === 'entreprises';
        const showPremiumBadge = isEnterpriseTab && !isPremium;

        return (
          <button
            key={id}
            type="button"
            onClick={() => onTabAttempt(id)}
            className={`group relative pb-3 -mb-px text-left transition-colors duration-150 ${
              active ? 'font-semibold' : 'font-medium text-[#6B7280] hover:text-ink/80'
            }`}
            style={{
              fontSize: 13,
              letterSpacing: '-0.01em',
              color: active ? ICON_COLORS.primary : undefined,
            }}
          >
            <span className="inline-flex items-center gap-2 flex-wrap">
              <TabIcon kind={icon} active={active} />
              <span>{label}</span>
              <span
                className="font-medium tabular"
                style={{ fontSize: 11.5, color: '#9CA3AF' }}
              >
                ({count})
              </span>
              {showPremiumBadge && (
                <span
                  className="ml-0.5 rounded font-semibold uppercase tracking-wide bg-accent/12 text-accent-dark ring-1 ring-accent/25"
                  style={{ fontSize: 8, padding: '2px 5px', letterSpacing: '0.06em' }}
                >
                  PREMIUM
                </span>
              )}
            </span>
            <span
              className="absolute left-0 right-0 bottom-0 h-[2px] rounded-full pointer-events-none"
              style={{
                backgroundColor: active ? '#E8743C' : 'transparent',
              }}
            />
          </button>
        );
      })}
    </div>
  );
}
