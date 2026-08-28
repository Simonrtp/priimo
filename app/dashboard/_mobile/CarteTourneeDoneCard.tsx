'use client';

import { useEffect, useRef } from 'react';
import { Flame, PartyPopper, Route } from 'lucide-react';
import { FIELD, formatDistance } from '@/lib/today/field';
import { formatWalkingDuration } from '@/lib/today/directions';
import { estimateWalkCalories, estimateWalkDurationS } from '@/lib/today/sortie-session';

/** La carte de fin se referme seule, sans bloquer le retour à la carte. */
const AUTO_CLOSE_MS = 5_200;

/** Bravo de fin de tournée : le récap de ce qui vient d'être marché. */
export default function CarteTourneeDoneCard({
  stopCount,
  distanceM,
  durationS,
  onClose,
}: {
  stopCount: number;
  distanceM: number;
  durationS: number | null;
  onClose: () => void;
}) {
  const duration = durationS ?? estimateWalkDurationS(distanceM);
  const calories = estimateWalkCalories(distanceM, duration);

  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const timer = setTimeout(() => close.current(), AUTO_CLOSE_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <button
        type="button"
        aria-label="Fermer"
        onClick={onClose}
        className="absolute inset-0 z-[75] cursor-default"
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[70] px-4">
        <div
          className="tour-brief overflow-hidden rounded-[26px] bg-surface shadow-[0_-12px_44px_rgba(15,23,34,0.24)] ring-1 ring-black/[0.06]"
          style={{ marginBottom: 'calc(12px + var(--field-nav-height))' }}
        >
          <div
            className="px-5 pb-5 pt-5"
            style={{ background: `linear-gradient(165deg, ${FIELD.vertPastel} 0%, #fff 46%)` }}
          >
            <div className="tour-brief__block flex items-start gap-3">
              <span
                className="flex size-11 flex-shrink-0 items-center justify-center rounded-2xl"
                style={{ backgroundColor: FIELD.vert, color: '#fff' }}
                aria-hidden
              >
                <PartyPopper size={22} strokeWidth={2.1} />
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className="text-[12px] font-semibold uppercase tracking-wide"
                  style={{ color: FIELD.vert }}
                >
                  Tournée terminée
                </p>
                <h2
                  className="mt-0.5 font-semibold text-text-strong"
                  style={{ fontSize: 23, lineHeight: 1.15 }}
                >
                  Bravo pour ta prospection ! 🎉
                </h2>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2.5">
              <Stat label="Adresses" value={String(stopCount)} />
              <Stat icon={Route} label="Marché" value={formatDistance(distanceM)} />
              <Stat icon={Flame} label="Énergie" value={`~${calories} kcal`} />
            </div>

            <p className="mt-4 text-pretty text-[14.5px] leading-snug text-text-muted">
              {formatWalkingDuration(duration)} sur le terrain — c&apos;est comme ça qu&apos;on rentre
              des mandats.
            </p>
          </div>

          <div className="border-t border-black/[0.06] px-4 py-3">
            <button
              type="button"
              onClick={onClose}
              className="app-press flex min-h-[48px] w-full items-center justify-center rounded-2xl font-semibold text-white"
              style={{ backgroundColor: FIELD.vert, fontSize: 15 }}
            >
              Revenir à la carte
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon?: typeof Route;
  label: string;
  value: string;
}) {
  return (
    <div className="tour-brief__block rounded-2xl bg-white/90 px-3 py-2.5 ring-1 ring-black/[0.05]">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
        {Icon ? <Icon size={12} strokeWidth={2.2} aria-hidden /> : null}
        {label}
      </div>
      <p className="mt-1 truncate tabular-nums text-[16px] font-semibold text-text-strong">{value}</p>
    </div>
  );
}
