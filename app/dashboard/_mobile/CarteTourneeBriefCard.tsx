'use client';

import { useEffect, useRef, useState } from 'react';
import { Flame, Route, Sparkles } from 'lucide-react';
import { FIELD, formatDistance } from '@/lib/today/field';
import { formatWalkingDuration } from '@/lib/today/directions';
import { estimateWalkCalories, estimateWalkDurationS } from '@/lib/today/sortie-session';

/** Rythme de la séquence : adresses → distance → énergie → sourire. */
const BEAT_MS = 760;
const HOLD_MS = 1250;
const COUNT_STEP_MS = 110;
const BLOCKS = 4;

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Brief d'ouverture de tournée. Tout se déroule seul : chaque ligne arrive à
 * son tour, puis la carte laisse place au chemin tracé. Un appui abrège.
 */
export default function CarteTourneeBriefCard({
  stopCount,
  distanceM,
  durationS,
  onDone,
}: {
  stopCount: number;
  distanceM: number;
  durationS: number | null;
  onDone: () => void;
}) {
  const [revealed, setRevealed] = useState(1);
  const [counted, setCounted] = useState(0);

  const duration = durationS ?? estimateWalkDurationS(distanceM);
  const calories = estimateWalkCalories(distanceM, duration);

  /** Le trajet Mapbox arrive pendant la séquence : ce re-rendu ne doit pas la rejouer. */
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    const finish = () => done.current();
    if (prefersReducedMotion()) {
      const end = setTimeout(finish, 900);
      setRevealed(BLOCKS);
      return () => clearTimeout(end);
    }
    const beats = Array.from({ length: BLOCKS - 1 }, (_, i) =>
      setTimeout(() => setRevealed(i + 2), BEAT_MS * (i + 1)),
    );
    const end = setTimeout(finish, BEAT_MS * (BLOCKS - 1) + HOLD_MS);
    return () => {
      for (const t of beats) clearTimeout(t);
      clearTimeout(end);
    };
  }, []);

  useEffect(() => {
    if (stopCount <= 0) return;
    if (prefersReducedMotion()) {
      setCounted(stopCount);
      return;
    }
    let current = 0;
    const tick = setInterval(() => {
      current += 1;
      setCounted(current);
      if (current >= stopCount) clearInterval(tick);
    }, COUNT_STEP_MS);
    return () => clearInterval(tick);
  }, [stopCount]);

  return (
    <>
      {/* Un appui n'importe où abrège la séquence. */}
      <button
        type="button"
        aria-label="Passer l’introduction"
        onClick={onDone}
        className="absolute inset-0 z-[75] cursor-default"
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[70] px-4">
        <div
          className="tour-brief overflow-hidden rounded-[26px] bg-surface shadow-[0_-12px_44px_rgba(15,23,34,0.24)] ring-1 ring-black/[0.06]"
          style={{ marginBottom: 'calc(12px + var(--field-nav-height))' }}
        >
          <div
            className="px-5 pb-5 pt-5"
            style={{ background: `linear-gradient(165deg, ${FIELD.orangePastel} 0%, #fff 46%)` }}
          >
            <div className="tour-brief__block flex items-start gap-3">
              <span
                className="flex size-11 flex-shrink-0 items-center justify-center rounded-2xl"
                style={{ backgroundColor: FIELD.orange, color: '#fff' }}
                aria-hidden
              >
                <Sparkles size={22} strokeWidth={2.1} />
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className="text-[12px] font-semibold uppercase tracking-wide"
                  style={{ color: FIELD.orange }}
                >
                  C&apos;est parti
                </p>
                <h2
                  className="mt-0.5 font-semibold text-text-strong"
                  style={{ fontSize: 23, lineHeight: 1.15 }}
                >
                  <span className="tabular-nums">{counted}</span> adresse
                  {stopCount > 1 ? 's' : ''} à prospecter
                </h2>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2.5">
              {revealed >= 2 ? (
                <StatPill
                  icon={Route}
                  label="Distance"
                  value={formatDistance(distanceM)}
                  sub={`${formatWalkingDuration(duration)} de marche`}
                />
              ) : (
                <StatSkeleton />
              )}
              {revealed >= 3 ? (
                <StatPill
                  icon={Flame}
                  label="Énergie"
                  value={`~${calories} kcal`}
                  sub="brûlées en chemin"
                />
              ) : (
                <StatSkeleton />
              )}
            </div>

            <div className="mt-4 min-h-[22px]">
              {revealed >= 4 ? (
                <p
                  className="tour-brief__block text-pretty text-[15.5px] font-medium leading-snug text-text-strong"
                  style={{ letterSpacing: '-0.01em' }}
                >
                  Garde le sourire, c&apos;est le plus important 😉
                </p>
              ) : null}
            </div>
          </div>

          <div className="h-[3px] w-full bg-black/[0.06]" aria-hidden>
            <div
              className="h-full transition-[width] duration-700 ease-out"
              style={{
                width: `${(revealed / BLOCKS) * 100}%`,
                backgroundColor: FIELD.orange,
              }}
            />
          </div>
        </div>
      </div>
    </>
  );
}

function StatSkeleton() {
  return <div className="h-[76px] rounded-2xl bg-white/55 ring-1 ring-black/[0.04]" aria-hidden />;
}

function StatPill({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Route;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="tour-brief__block h-[76px] rounded-2xl bg-white/90 px-3 py-2.5 ring-1 ring-black/[0.05]">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
        <Icon size={13} strokeWidth={2.2} aria-hidden />
        {label}
      </div>
      <p className="mt-1 tabular-nums text-[17px] font-semibold text-text-strong">{value}</p>
      <p className="truncate text-[11.5px] text-text-muted">{sub}</p>
    </div>
  );
}
