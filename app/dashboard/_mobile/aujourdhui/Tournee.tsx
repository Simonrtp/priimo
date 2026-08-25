'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MapPin } from 'lucide-react';
import type { GeoCoord } from '@/lib/carte/coords';
import type { SortiePlan, SortieProgress, SortieStop } from '@/lib/today/sortie';
import { haversineM } from '@/lib/today/sortie';
import { staticTourneeUrl } from '@/lib/today/static-map';
import { tourneeQuadrantLabel, tourneeTitle } from '@/lib/today/quadrant';
import {
  FIELD,
  bearingDegrees,
  cardinalFrom,
  formatDistance,
  mapsItineraireUrl,
} from '@/lib/today/field';
import { watchDevicePosition } from '@/lib/voice/gps';
import { tapProps } from './tap';
import ScoreRing from '@/components/dashboard/ScoreRing';

export function TourneeCard({
  tournee,
  doneCount,
  sectorRef,
  onStart,
}: {
  tournee: SortiePlan;
  doneCount: number;
  sectorRef: GeoCoord | null;
  onStart: () => void;
}) {
  const n = tournee.ordered.length;
  const quadrantLabel = tourneeQuadrantLabel(tournee.ordered, sectorRef);
  const title = tourneeTitle({ stopCount: n, quadrantLabel });
  const mapUrl = staticTourneeUrl(tournee.ordered, 800, 360);

  return (
    <button
      type="button"
      className="relative isolate w-full overflow-hidden rounded-[24px] text-left shadow-[0_18px_50px_-12px_rgba(15,23,34,0.55)] ring-1 ring-white/20 transition-transform active:scale-[0.99]"
      style={{ minHeight: mapUrl ? 280 : 168 }}
      aria-label={`Ouvrir l'itinéraire : ${title}`}
      {...tapProps(onStart)}
    >
      {mapUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mapUrl}
            alt=""
            className="absolute inset-0 size-full object-cover object-center brightness-[1.03] contrast-[1.06]"
          />
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-[38%] bg-gradient-to-t from-[#15202F]/85 via-[#15202F]/30 to-transparent"
            aria-hidden
          />
        </>
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(145deg, ${FIELD.ardoise} 0%, #24384F 55%, #1E3148 100%)`,
          }}
          aria-hidden
        />
      )}

      <div
        className="pointer-events-none absolute inset-0 rounded-[24px] ring-1 ring-inset ring-white/25"
        aria-hidden
      />

      <div className="absolute inset-x-2.5 bottom-2.5 rounded-[16px] border border-white/28 bg-[#1E3148]/40 px-3.5 py-2.5 shadow-[0_6px_24px_rgba(15,23,34,0.22),inset_0_1px_0_rgba(255,255,255,0.22)] backdrop-blur-md supports-[backdrop-filter]:bg-[#1E3148]/28">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p
              className="font-semibold uppercase tracking-[0.1em]"
              style={{ color: '#F5A882', fontSize: 9.5 }}
            >
              Sortie terrain
            </p>
            <h2
              className="mt-0.5 truncate font-semibold text-white"
              style={{ fontSize: 15.5, lineHeight: 1.2, letterSpacing: '-0.02em' }}
            >
              {title}
            </h2>
          </div>
          <div
            className="flex size-8 flex-shrink-0 items-center justify-center rounded-full border border-white/30 bg-white/12"
            aria-hidden
          >
            <MapPin size={15} strokeWidth={2.25} style={{ color: '#F5A882' }} />
          </div>
        </div>

        <div className="mt-2 flex items-center gap-2.5">
          <p className="min-w-0 flex-1 truncate text-[12px] font-medium text-white/80">
            {n} adresse{n > 1 ? 's' : ''} · {formatDistance(tournee.distanceM)} à pied
          </p>
          <span className="shrink-0 tabular-nums text-[10px] font-semibold text-white/75">
            {doneCount}/{n}
          </span>
        </div>
        <div className="mt-1.5 h-0.5 overflow-hidden rounded-full bg-white/18" aria-hidden>
          <div
            className="h-full rounded-full transition-[width] duration-300"
            style={{
              width: `${n === 0 ? 0 : Math.round((doneCount / n) * 100)}%`,
              backgroundColor: FIELD.orange,
            }}
          />
        </div>
      </div>
    </button>
  );
}

function TourProgressRing({ done, total }: { done: number; total: number }) {
  const r = 18;
  const c = 2 * Math.PI * r;
  const progress = total <= 0 ? 1 : Math.min(1, done / total);
  const offset = c * (1 - progress);

  return (
    <div className="relative size-11 flex-shrink-0" aria-hidden>
      <svg viewBox="0 0 44 44" className="size-11 -rotate-90">
        <circle cx="22" cy="22" r={r} fill="none" stroke="rgba(61,90,128,0.18)" strokeWidth="4" />
        <circle
          cx="22"
          cy="22"
          r={r}
          fill="none"
          stroke={FIELD.orange}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center font-semibold tabular-nums text-text-strong"
        style={{ fontSize: 12 }}
      >
        {Math.min(done, total)}/{total}
      </span>
    </div>
  );
}

export function TourneeMode({
  plan,
  progress,
  onClose,
  onDone,
  onSkip,
  onDicter,
}: {
  plan: SortiePlan;
  progress: SortieProgress;
  onClose: () => void;
  onDone: (key: string) => void;
  onSkip: (key: string) => void;
  onDicter: (stop: SortieStop) => void;
}) {
  const done = new Set(progress.done);
  const skipped = new Set(progress.skipped);
  const active = plan.ordered.find((s) => !done.has(s.key) && !skipped.has(s.key)) ?? null;
  const finished = active === null;
  const [here, setHere] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    return watchDevicePosition(setHere);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const n = plan.ordered.length;
  const doneCount = progress.done.length;
  const dist = here && active ? haversineM(here, { latitude: active.latitude, longitude: active.longitude }) : null;
  const dir =
    here && active
      ? cardinalFrom(bearingDegrees(here, { latitude: active.latitude, longitude: active.longitude }))
      : null;

  return (
    <div
      className="fixed inset-0 z-[85] flex flex-col bg-bg-base"
      role="dialog"
      aria-modal="true"
      aria-label="Sortie du jour"
      style={{ height: '100dvh' }}
    >
      <header
        className="flex flex-shrink-0 items-center justify-between px-3"
        style={{ paddingTop: 'calc(8px + env(safe-area-inset-top, 0px))' }}
      >
        <button
          type="button"
          className="app-press flex min-h-[44px] items-center px-2 text-[14px] font-medium text-text-muted"
          {...tapProps(onClose)}
        >
          Quitter
        </button>
        <TourProgressRing done={doneCount} total={n} />
        <span className="w-16" aria-hidden />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
        {finished ? (
          <div className="flex flex-col items-center pt-8 text-center">
            <div className="relative size-16" aria-hidden>
              <svg viewBox="0 0 64 64" className="size-16">
                <circle cx="32" cy="32" r="26" fill={FIELD.vertPastel} stroke={FIELD.vert} strokeWidth="6" />
              </svg>
            </div>
            <h2 className="mt-5 text-balance font-semibold text-text-strong" style={{ fontSize: 20 }}>
              Sortie terminée · {n} adresse{n > 1 ? 's' : ''}
            </h2>
            <ul className="mt-6 w-full text-left">
              {plan.ordered.map((stop) => (
                <li key={stop.key} className="border-t border-black/[0.06] py-2.5 text-[14px] text-text">
                  <p className="text-pretty font-medium text-text-strong">{stop.address}</p>
                  <p className="mt-0.5 text-[12.5px] text-text-muted">
                    {progress.done.includes(stop.key)
                      ? 'Faite'
                      : progress.dictees.includes(stop.key)
                        ? 'Dictée faite'
                        : 'Passée'}
                  </p>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="mt-6 flex min-h-[44px] w-full items-center justify-center rounded-[12px] font-semibold text-white"
              style={{ backgroundColor: FIELD.orange, fontSize: 14.5 }}
              {...tapProps(onClose)}
            >
              Fermer
            </button>
          </div>
        ) : (
          <div className="flex min-h-full flex-col pt-6">
            <p className="font-semibold uppercase text-text-subtle" style={{ fontSize: 11 }}>
              Adresse {plan.ordered.indexOf(active!) + 1} sur {n}
            </p>
            <h2 className="mt-2 text-balance font-semibold text-text-strong" style={{ fontSize: 26, lineHeight: 1.2 }}>
              {active!.address}
            </h2>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <ScoreRing score={active!.score} size={44} />
              {active!.surfaceM2 ? (
                <span className="text-[14px] text-text-muted">{active!.surfaceM2} m²</span>
              ) : null}
              {active!.etage ? (
                <span className="text-[14px] text-text-muted">Étage {active!.etage}</span>
              ) : null}
            </div>

            {active!.mainSignalLabel ? (
              <p className="mt-3 text-[14px] text-text">{active!.mainSignalLabel}</p>
            ) : null}
            {active!.notes ? (
              <p
                className="mt-2 rounded-xl px-3 py-2 text-pretty text-[13.5px] text-text-muted"
                style={{ backgroundColor: FIELD.creme }}
              >
                {active!.notes}
              </p>
            ) : null}

            <p className="mt-6 tabular-nums font-semibold text-text-strong" style={{ fontSize: 18 }}>
              {dist !== null && dir ? `${formatDistance(dist)} · ${dir}` : 'Position en cours…'}
            </p>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-black/[0.08]" aria-hidden>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${n === 0 ? 0 : Math.round((doneCount / n) * 100)}%`,
                  backgroundColor: FIELD.orange,
                }}
              />
            </div>

            <div className="mt-auto flex flex-col gap-2 pt-10" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
              <a
                href={mapsItineraireUrl(active!.latitude, active!.longitude)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-[48px] items-center justify-center rounded-[12px] font-semibold text-white"
                style={{ backgroundColor: FIELD.ardoise, fontSize: 15 }}
              >
                Itinéraire
              </a>
              <button
                type="button"
                className="flex min-h-[48px] items-center justify-center rounded-[12px] font-semibold text-white"
                style={{ backgroundColor: FIELD.orange, fontSize: 15 }}
                {...tapProps(() => onDicter(active!))}
              >
                Dicter ici
              </button>
              <button
                type="button"
                className="flex min-h-[48px] items-center justify-center rounded-[12px] font-semibold"
                style={{ backgroundColor: FIELD.ardoisePastel, color: FIELD.ardoise, fontSize: 15 }}
                {...tapProps(() => onDone(active!.key))}
              >
                Marquer comme faite
              </button>
              <button
                type="button"
                className="flex min-h-[48px] items-center justify-center text-[15px] font-medium text-text-muted"
                {...tapProps(() => onSkip(active!.key))}
              >
                Passer
              </button>
              <Link
                href={`/dashboard/prospection?lead=${active!.leadId}`}
                className="mt-1 text-center text-[13px] font-medium text-text-strong underline decoration-black/25"
              >
                Ouvrir la fiche
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
