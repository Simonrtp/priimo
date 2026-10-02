'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  LIBELLE_PERIODE,
  PRESETS_PERIODE,
  TITRE_PERIODE,
  type Intervalle,
  type Periode,
} from '@/lib/activite/semaines';
import { PASTILLE_TRACK, pastilleClass } from '@/components/ui/pastille-classes';
import { addMonths, buildMonthCells, parseIsoDate, startOfMonth } from '@/lib/ui/date-picker';
import { dateKeyParis } from '@/lib/today/calendar';
import { FIELD } from '@/lib/today/field';

const JOURS_CAL = ['lu', 'ma', 'me', 'je', 've', 'sa', 'di'] as const;

function titreDe(periode: Periode, intervalle: Intervalle): string {
  if (periode === 'custom' && intervalle.debut === intervalle.fin) return 'Ma journée';
  return TITRE_PERIODE[periode];
}

/**
 * Où l'agent se trouve dans le temps, et rien d'autre.
 *
 * À gauche, le titre ; à droite, 7j / 30j / 90j et le calendrier
 * pour une plage libre. Le retour au présent n'apparaît que sur une plage
 * choisie.
 */
export default function EnteteSemaine({
  periode,
  intervalle,
  estPeriodeCourante,
  enCours,
  onChanger,
  debut,
  droite,
}: {
  periode: Periode;
  intervalle: Intervalle;
  estPeriodeCourante: boolean;
  enCours: boolean;
  onChanger: (periode: Periode, ancre: string | null, fin?: string | null) => void;
  debut?: ReactNode;
  droite?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="flex min-w-0 items-center gap-4">
        {debut ? <div className="shrink-0">{debut}</div> : null}
        <div className="min-w-0 max-sm:hidden">
          <h1 className="font-display text-[24px] font-bold leading-none tracking-[-0.01em] text-text-strong">
            {titreDe(periode, intervalle)}
          </h1>
          {!estPeriodeCourante ? (
            <p className="mt-1.5">
              <button
                type="button"
                onClick={() => onChanger('7j', null)}
                className="text-[13px] font-semibold text-primary-600 transition-colors hover:text-primary-700"
              >
                Revenir aux 7 derniers jours
              </button>
            </p>
          ) : null}
        </div>
        <h1 className="sr-only sm:hidden">{titreDe(periode, intervalle)}</h1>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3 lg:min-w-0 lg:flex-1 lg:justify-end">
        <SelecteurFenetre
          periode={periode}
          intervalle={intervalle}
          enCours={enCours}
          onChanger={onChanger}
        />
        {droite ? <div className="min-w-0 sm:order-1 sm:w-[15rem] lg:w-[18rem]">{droite}</div> : null}
      </div>

      {!estPeriodeCourante ? (
        <button
          type="button"
          onClick={() => onChanger('7j', null)}
          className="self-start text-[13px] font-semibold text-primary-600 sm:hidden"
        >
          Revenir aux 7 derniers jours
        </button>
      ) : null}
    </header>
  );
}

function SelecteurFenetre({
  periode,
  intervalle,
  enCours,
  onChanger,
}: {
  periode: Periode;
  intervalle: Intervalle;
  enCours: boolean;
  onChanger: (periode: Periode, ancre: string | null, fin?: string | null) => void;
}) {
  const [ouvert, setOuvert] = useState(false);
  const racine = useRef<HTMLDivElement>(null);
  const popover = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);

  const fermer = useCallback(() => setOuvert(false), []);

  useLayoutEffect(() => {
    if (!ouvert) {
      setMenuPos(null);
      return;
    }
    function place() {
      const btn = trigger.current;
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      const popW = 280;
      const left = Math.min(Math.max(8, r.right - popW), window.innerWidth - popW - 8);
      setMenuPos({ top: r.bottom + 8, left });
    }
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [ouvert]);

  useEffect(() => {
    if (!ouvert) return;
    let cleanup: (() => void) | undefined;
    const t = window.setTimeout(() => {
      function onPointer(e: PointerEvent) {
        const cible = e.target;
        if (!(cible instanceof Node)) return;
        if (racine.current?.contains(cible) || popover.current?.contains(cible)) return;
        fermer();
      }
      function onKey(e: KeyboardEvent) {
        if (e.key === 'Escape') fermer();
      }
      document.addEventListener('pointerdown', onPointer, true);
      document.addEventListener('keydown', onKey);
      cleanup = () => {
        document.removeEventListener('pointerdown', onPointer, true);
        document.removeEventListener('keydown', onKey);
      };
    }, 0);
    return () => {
      window.clearTimeout(t);
      cleanup?.();
    };
  }, [ouvert, fermer]);

  return (
    <div ref={racine} className="relative sm:order-2">
      <nav aria-label="Période" aria-busy={enCours} className={`${PASTILLE_TRACK} max-sm:w-full`}>
        <div className="flex flex-1 justify-between gap-0.5 sm:justify-start">
          {PRESETS_PERIODE.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={p === periode}
              onClick={() => {
                fermer();
                onChanger(p, null);
              }}
              className={`${pastilleClass(p === periode)} flex-1 sm:flex-none`}
            >
              {LIBELLE_PERIODE[p]}
            </button>
          ))}
          <button
            ref={trigger}
            type="button"
            aria-pressed={periode === 'custom'}
            aria-expanded={ouvert}
            aria-haspopup="dialog"
            aria-label="Choisir une période"
            onClick={() => setOuvert((v) => !v)}
            className={`${pastilleClass(periode === 'custom' || ouvert)} flex size-8 shrink-0 items-center justify-center px-0`}
          >
            <CalendarDays size={14} strokeWidth={2.2} aria-hidden />
          </button>
        </div>
      </nav>
      {ouvert && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={popover}
              style={
                menuPos
                  ? { top: menuPos.top, left: menuPos.left }
                  : { top: -9999, left: -9999, visibility: 'hidden' }
              }
              className="fixed z-[200]"
            >
              <CalendrierPlage
                intervalle={intervalle}
                onChoisir={(debut, fin) => {
                  fermer();
                  onChanger('custom', debut, fin);
                }}
              />
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function CalendrierPlage({
  intervalle,
  onChoisir,
}: {
  intervalle: Intervalle;
  onChoisir: (debut: string, fin: string) => void;
}) {
  const aujourdhui = dateKeyParis(new Date());
  const ancre = parseIsoDate(intervalle.fin) ?? new Date();
  const [vue, setVue] = useState(() => startOfMonth(ancre));
  const [brouillon, setBrouillon] = useState<string | null>(null);
  const [survol, setSurvol] = useState<string | null>(null);
  const cells = useMemo(() => buildMonthCells(vue), [vue]);

  const plage = brouillon
    ? {
        debut: survol && survol < brouillon ? survol : brouillon,
        fin: survol && survol > brouillon ? survol : brouillon,
      }
    : intervalle;

  function pick(iso: string) {
    if (!brouillon) {
      setBrouillon(iso);
      setSurvol(iso);
      return;
    }
    const debut = brouillon <= iso ? brouillon : iso;
    const fin = brouillon <= iso ? iso : brouillon;
    onChoisir(debut, fin);
  }

  return (
    <div
      role="dialog"
      aria-label="Choisir une période"
      className="w-[280px] rounded-clay-lg border border-black/12 bg-white p-2 shadow-clay"
    >
      <div className="flex items-center justify-between gap-2 px-1 pb-2">
        <button
          type="button"
          onClick={() => setVue((d) => addMonths(d, -1))}
          aria-label="Mois précédent"
          className="flex size-9 items-center justify-center rounded-lg text-text-strong hover:bg-black/[0.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <ChevronLeft size={18} aria-hidden />
        </button>
        <p className="text-[13.5px] font-semibold capitalize text-text-strong">
          {vue.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
        </p>
        <button
          type="button"
          onClick={() => setVue((d) => addMonths(d, 1))}
          aria-label="Mois suivant"
          className="flex size-9 items-center justify-center rounded-lg text-text-strong hover:bg-black/[0.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <ChevronRight size={18} aria-hidden />
        </button>
      </div>
      <p className="px-1 pb-2 text-[11.5px] text-text-muted">
        {brouillon ? 'Choisir le dernier jour' : 'Choisir le premier jour, puis le dernier'}
      </p>
      <div className="grid grid-cols-7 gap-0.5 px-1 pb-1">
        {JOURS_CAL.map((j) => (
          <span
            key={j}
            className="py-1 text-center text-[10.5px] font-semibold uppercase"
            style={{ color: FIELD.ardoise }}
          >
            {j}
          </span>
        ))}
        {cells.map(({ iso, inMonth }) => {
          const futur = iso > aujourdhui;
          const dansPlage = inMonth && iso >= plage.debut && iso <= plage.fin;
          const bout = iso === plage.debut || iso === plage.fin;
          return (
            <button
              key={iso}
              type="button"
              disabled={!inMonth || futur}
              onClick={() => inMonth && !futur && pick(iso)}
              onMouseEnter={() => inMonth && !futur && brouillon && setSurvol(iso)}
              aria-pressed={bout}
              className={`flex size-8 items-center justify-center rounded-lg text-[12.5px] tabular-nums ${
                !inMonth
                  ? 'cursor-default text-transparent'
                  : futur
                    ? 'cursor-default text-text-subtle'
                    : bout
                      ? 'font-semibold text-white'
                      : dansPlage
                        ? 'font-semibold text-text-strong'
                        : 'font-medium text-text-strong hover:bg-[#FFF7F0]'
              }`}
              style={
                bout && inMonth && !futur
                  ? { backgroundColor: FIELD.ardoise }
                  : dansPlage && inMonth && !futur
                    ? { backgroundColor: `${FIELD.ardoise}18` }
                    : undefined
              }
            >
              {inMonth ? iso.slice(8, 10).replace(/^0/, '') : ''}
            </button>
          );
        })}
      </div>
      <div className="border-t border-black/10 px-2 pt-2">
        <button
          type="button"
          onClick={() => onChoisir(aujourdhui, aujourdhui)}
          className="min-h-9 w-full rounded-lg text-[12.5px] font-semibold hover:bg-[#FFF7F0] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          style={{ color: FIELD.ardoise }}
        >
          Aujourd&apos;hui
        </button>
      </div>
    </div>
  );
}
