'use client';

import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import {
  LIBELLE_PERIODE,
  intervalleDecale,
  type Intervalle,
  type Periode,
} from '@/lib/activite/semaines';

const PERIODES: Periode[] = ['jour', 'semaine', 'mois', 'annee'];

const TITRE_PERIODE: Record<Periode, string> = {
  jour: 'Ma journée',
  semaine: 'Ma semaine',
  mois: 'Mon mois',
  annee: 'Mon année',
};

function jourLisible(cle: string): string {
  const [y, m, d] = cle.split('-').map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1, 12)).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
}

/** « 31 août – 6 septembre 2026 », sans répéter le mois quand il est le même. */
export function intervalleLisible(intervalle: Intervalle, periode: Periode): string {
  const [ay, am] = intervalle.debut.split('-').map(Number);
  const [by, bm] = intervalle.fin.split('-').map(Number);

  if (periode === 'jour') return `${jourLisible(intervalle.debut)} ${ay}`;
  if (periode === 'annee') return String(ay);
  if (periode === 'mois') {
    return new Date(Date.UTC(ay ?? 1970, (am ?? 1) - 1, 15, 12)).toLocaleDateString('fr-FR', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
  }

  const debut =
    am === bm && ay === by
      ? String(Number(intervalle.debut.slice(8)))
      : jourLisible(intervalle.debut);
  return `${debut} – ${jourLisible(intervalle.fin)} ${by}`;
}

export default function EnteteSemaine({
  periode,
  intervalle,
  estPeriodeCourante,
  enCours,
  onChanger,
  gauche,
}: {
  periode: Periode;
  intervalle: Intervalle;
  estPeriodeCourante: boolean;
  /** Le bilan de la période demandée est en route. */
  enCours: boolean;
  /** Change la granularité ou l'ancre. `null` en ancre = période en cours. */
  onChanger: (periode: Periode, ancre: string | null) => void;
  /** Coin haut gauche : le pense-bête, avant le titre de période. */
  gauche?: ReactNode;
}) {
  const decaler = (delta: number) =>
    onChanger(periode, intervalleDecale(periode, intervalle, delta).debut);

  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
      {gauche}
      <div className="hidden shrink-0 sm:block">
        <h1 className="text-balance font-display text-[17px] font-bold leading-tight text-text-strong sm:text-[19px]">
          {TITRE_PERIODE[periode]}
        </h1>
        <p className="mt-0.5 text-[13px] text-text-muted">{intervalleLisible(intervalle, periode)}</p>
      </div>
      <h1 className="sr-only sm:hidden">{TITRE_PERIODE[periode]}</h1>

      <div className="flex items-center justify-end gap-2 sm:order-last sm:ml-auto" aria-busy={enCours}>
        <div
          role="group"
          aria-label="Granularité"
          className="flex rounded-clay bg-surface-2 p-1 shadow-clay-inset"
        >
          {PERIODES.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={p === periode}
              onClick={() => onChanger(p, null)}
              className={`rounded-[12px] px-2.5 py-1.5 text-[12px] font-semibold transition-colors duration-fluid-subtle ${
                p === periode
                  ? 'bg-surface text-text-strong shadow-clay-sm'
                  : 'text-text-muted hover:text-text-strong'
              }`}
            >
              {LIBELLE_PERIODE[p]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => decaler(-1)}
            aria-label={`${LIBELLE_PERIODE[periode]} précédent`}
            className="flex size-9 items-center justify-center rounded-clay bg-surface text-text-muted shadow-clay-sm transition hover:text-text-strong active:shadow-clay-pressed"
          >
            <ChevronLeft size={17} strokeWidth={2.2} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => decaler(1)}
            disabled={estPeriodeCourante}
            aria-label={`${LIBELLE_PERIODE[periode]} suivant`}
            className="flex size-9 items-center justify-center rounded-clay bg-surface text-text-muted shadow-clay-sm transition hover:text-text-strong active:shadow-clay-pressed disabled:cursor-not-allowed disabled:opacity-35 disabled:shadow-none"
          >
            <ChevronRight size={17} strokeWidth={2.2} aria-hidden />
          </button>
          {!estPeriodeCourante ? (
            <button
              type="button"
              onClick={() => onChanger(periode, null)}
              className="flex h-9 items-center gap-1.5 rounded-clay bg-surface px-3 text-[12px] font-semibold text-text-muted shadow-clay-sm transition hover:text-text-strong"
            >
              <RotateCcw size={13} strokeWidth={2.2} aria-hidden />
              Aujourd’hui
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
