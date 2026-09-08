'use client';

import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useTransition } from 'react';
import {
  LIBELLE_PERIODE,
  intervalleDecale,
  type Intervalle,
  type Periode,
} from '@/lib/activite/semaines';
import CitationCard from './CitationCard';

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
  citation,
}: {
  periode: Periode;
  intervalle: Intervalle;
  estPeriodeCourante: boolean;
  citation: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [enCours, startTransition] = useTransition();

  // La navigation passe par l'URL : l'écran reste rendu côté serveur, et une
  // semaine consultée se partage par simple copier-coller du lien.
  const naviguer = useCallback(
    (next: { periode?: Periode; ancre?: string | null }) => {
      const q = new URLSearchParams(params?.toString() ?? '');
      if (next.periode) q.set('periode', next.periode);
      if (next.ancre === null) q.delete('le');
      else if (next.ancre) q.set('le', next.ancre);
      startTransition(() => router.push(`/dashboard?${q.toString()}`, { scroll: false }));
    },
    [params, router],
  );

  const decaler = (delta: number) =>
    naviguer({ ancre: intervalleDecale(periode, intervalle, delta).debut });

  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
      <div className="shrink-0">
        <h1 className="font-display text-[17px] font-bold leading-tight text-text-strong sm:text-[19px]">
          {TITRE_PERIODE[periode]}
        </h1>
        <p className="mt-0.5 text-[13px] text-text-muted">
          {intervalleLisible(intervalle, periode)}
        </p>
      </div>

      <CitationCard texte={citation} className="min-w-0 sm:flex-1" />

      <div className="flex shrink-0 items-center gap-2" aria-busy={enCours}>
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
                onClick={() => naviguer({ periode: p, ancre: null })}
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
              className="flex h-9 w-9 items-center justify-center rounded-clay bg-surface text-text-muted shadow-clay-sm transition hover:text-text-strong active:shadow-clay-pressed"
            >
              <ChevronLeft size={17} strokeWidth={2.2} aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => decaler(1)}
              disabled={estPeriodeCourante}
              aria-label={`${LIBELLE_PERIODE[periode]} suivant`}
              className="flex h-9 w-9 items-center justify-center rounded-clay bg-surface text-text-muted shadow-clay-sm transition hover:text-text-strong active:shadow-clay-pressed disabled:cursor-not-allowed disabled:opacity-35 disabled:shadow-none"
            >
              <ChevronRight size={17} strokeWidth={2.2} aria-hidden />
            </button>
            {!estPeriodeCourante ? (
              <button
                type="button"
                onClick={() => naviguer({ ancre: null })}
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
