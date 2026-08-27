'use client';

import { Flame, MapPin, Sparkles } from 'lucide-react';
import { FIELD, formatDistance } from '@/lib/today/field';
import { formatWalkingDuration } from '@/lib/today/directions';
import { estimateWalkCalories, estimateWalkDurationS } from '@/lib/today/sortie-session';
import { armPointerShield } from '@/lib/ui/pointer-guard';

export default function CarteTourneeBriefCard({
  stopCount,
  distanceM,
  durationS,
  onStart,
  onBack,
}: {
  stopCount: number;
  distanceM: number;
  durationS: number | null;
  onStart: () => void;
  onBack: () => void;
}) {
  const duration = durationS ?? estimateWalkDurationS(distanceM);
  const calories = estimateWalkCalories(distanceM, duration);

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[70] px-4">
      <div
        className="pointer-events-auto overflow-hidden rounded-[24px] bg-surface shadow-[0_-12px_40px_rgba(15,23,34,0.22)] ring-1 ring-black/[0.06]"
        style={{ marginBottom: 'calc(12px + var(--field-nav-height))' }}
      >
        <div
          className="px-5 pb-4 pt-5"
          style={{
            background: `linear-gradient(165deg, ${FIELD.orangePastel} 0%, #fff 42%)`,
          }}
        >
          <div className="flex items-start gap-3">
            <span
              className="flex size-11 flex-shrink-0 items-center justify-center rounded-2xl"
              style={{ backgroundColor: FIELD.orange, color: '#fff' }}
              aria-hidden
            >
              <Sparkles size={22} strokeWidth={2.1} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: FIELD.orange }}>
                C&apos;est parti
              </p>
              <h2 className="mt-0.5 font-semibold text-text-strong" style={{ fontSize: 22, lineHeight: 1.15 }}>
                {stopCount} adresse{stopCount > 1 ? 's' : ''} à prospecter
              </h2>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <StatPill
              icon={MapPin}
              label="Distance"
              value={formatDistance(distanceM)}
              sub={formatWalkingDuration(duration)}
            />
            <StatPill icon={Flame} label="Énergie" value={`~${calories} kcal`} sub="marche estimée" />
          </div>

          <p
            className="mt-4 text-pretty text-[15px] font-medium leading-snug text-text-strong"
            style={{ letterSpacing: '-0.01em' }}
          >
            Garde ton sourire, c&apos;est le plus important 😉
          </p>
        </div>

        <div className="flex gap-2 border-t border-black/[0.06] px-4 py-3">
          <button
            type="button"
            onClick={() => {
              armPointerShield();
              onBack();
            }}
            className="app-press flex min-h-[48px] flex-1 items-center justify-center rounded-2xl bg-black/[0.05] text-[14px] font-semibold text-text"
          >
            Modifier
          </button>
          <button
            type="button"
            onClick={onStart}
            className="app-press flex min-h-[48px] flex-[1.4] items-center justify-center rounded-2xl font-semibold text-white"
            style={{ backgroundColor: FIELD.orange, fontSize: 15 }}
          >
            Lancer le guidage
          </button>
        </div>
      </div>
    </div>
  );
}

function StatPill({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof MapPin;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-2xl bg-white/90 px-3 py-2.5 ring-1 ring-black/[0.05]">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
        <Icon size={13} strokeWidth={2.2} aria-hidden />
        {label}
      </div>
      <p className="mt-1 tabular-nums text-[17px] font-semibold text-text-strong">{value}</p>
      <p className="text-[11.5px] text-text-muted">{sub}</p>
    </div>
  );
}
