'use client';

import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { COULEUR_FAMILLE } from '@/lib/activite/couleurs';
import type { JourActivite } from '@/lib/activite/bilan';
import { FAMILLES_ACTIVITE, LIBELLE_ACTIVITE } from '@/lib/activite/types';
import { FIELD } from '@/lib/today/field';
import { dateKeyParis } from '@/lib/today/calendar';
import { useOutsideDismiss } from '@/lib/hooks/useOutsideDismiss';
import {
  addMonths,
  buildMonthCells,
  parseIsoDate,
  startOfMonth,
} from '@/lib/ui/date-picker';

const COURT: Record<(typeof FAMILLES_ACTIVITE)[number], string> = {
  contacts_physiques: 'Contacts',
  immeubles_prospectes: 'Immeubles',
  contacts_qualifies: 'Qualifiés',
  estimations: 'Estim.',
  informations_terrain: 'Infos',
};

const JOURS_CAL = ['lu', 'ma', 'me', 'je', 've', 'sa', 'di'] as const;

function jourCourt(cle: string): string {
  const [y, m, d] = cle.split('-').map(Number);
  const date = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1, 12));
  return date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', timeZone: 'UTC' });
}

function intervalleLisible(debut: string, fin: string): string {
  const a = new Date(`${debut}T12:00:00Z`);
  const b = new Date(`${fin}T12:00:00Z`);
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', timeZone: 'UTC' };
  return `${a.toLocaleDateString('fr-FR', opts)} – ${b.toLocaleDateString('fr-FR', opts)}`;
}

function moisLabel(d: Date): string {
  return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

/**
 * Les 7 derniers jours, même jour de semaine à même jour (lundi → lundi).
 * Replié par défaut. Masqué en mobile.
 */
export default function JourParJour({
  jours,
  jourActif = null,
  onChoisirJour,
}: {
  jours: readonly JourActivite[];
  /** Jour dont on lit les stats en tête d’Accueil, si on a choisi un jour. */
  jourActif?: string | null;
  onChoisirJour?: (jour: string) => void;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [calendrierOuvert, setCalendrierOuvert] = useState(false);
  const calRef = useRef<HTMLDivElement>(null);
  useOutsideDismiss(calendrierOuvert, () => setCalendrierOuvert(false), calRef);

  const aujourdhui = dateKeyParis(new Date());
  const selection = jourActif && jourActif <= aujourdhui ? jourActif : aujourdhui;

  if (jours.length === 0) return null;

  const totaux = FAMILLES_ACTIVITE.map((f) => ({
    famille: f,
    total: jours.reduce((s, j) => s + j.compteurs[f], 0),
  }));
  const debut = jours[0]!.jour;
  const fin = jours[jours.length - 1]!.jour;

  return (
    <section className="max-md:hidden">
      <div
        ref={calRef}
        className="relative flex items-center gap-2 rounded-clay-lg bg-surface px-4 py-3.5 shadow-clay-sm"
      >
        <button
          type="button"
          onClick={() => setCalendrierOuvert((v) => !v)}
          aria-expanded={calendrierOuvert}
          aria-haspopup="dialog"
          aria-label="Choisir un jour"
          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-text-muted hover:bg-black/[0.05] hover:text-text-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <CalendarDays size={17} strokeWidth={2.2} aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => setOuvert((v) => !v)}
          aria-expanded={ouvert}
          className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <span className="flex min-w-0 flex-wrap items-baseline gap-x-2.5">
            <span className="font-display text-[15px] font-bold text-text-strong">
              Mon activité du jour
            </span>
            <span className="text-[13px] font-medium text-text-muted">
              {intervalleLisible(debut, fin)}
            </span>
          </span>
          <ChevronDown
            size={17}
            strokeWidth={2.2}
            aria-hidden
            className={`shrink-0 text-text-muted transition-transform duration-fluid-subtle ${
              ouvert ? 'rotate-180' : ''
            }`}
          />
        </button>
        {calendrierOuvert ? (
          <CalendrierJour
            selection={selection}
            aujourdhui={aujourdhui}
            onChoisir={(jour) => {
              setCalendrierOuvert(false);
              setOuvert(true);
              onChoisirJour?.(jour);
            }}
          />
        ) : null}
      </div>

      {ouvert ? (
        <div className="mt-2 overflow-x-auto rounded-clay-lg border border-black/10 bg-surface p-2 shadow-clay-sm">
          <table className="w-full min-w-[520px] border-collapse text-[12.5px]">
            <caption className="sr-only">
              Activité des sept derniers jours, du même jour de semaine à aujourd’hui
            </caption>
            <thead>
              <tr>
                <th scope="col" className="px-3 py-2.5 text-left font-semibold text-text-strong">
                  Jour
                </th>
                {FAMILLES_ACTIVITE.map((f) => (
                  <th
                    key={f}
                    scope="col"
                    className="px-3 py-2.5 text-right font-semibold text-text-strong"
                    title={LIBELLE_ACTIVITE[f]}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        aria-hidden
                        className="size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: COULEUR_FAMILLE[f].teinte }}
                      />
                      {COURT[f]}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {jours.map((j) => {
                const actif = j.jour === selection;
                return (
                  <tr
                    key={j.jour}
                    className="border-t border-black/10"
                    style={actif ? { backgroundColor: 'rgba(61, 90, 128, 0.1)' } : undefined}
                  >
                    <th scope="row" className="px-3 py-2.5 text-left font-semibold text-text-strong">
                      {onChoisirJour ? (
                        <button
                          type="button"
                          onClick={() => onChoisirJour(j.jour)}
                          className="rounded-md text-left hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                        >
                          {jourCourt(j.jour)}
                        </button>
                      ) : (
                        jourCourt(j.jour)
                      )}
                    </th>
                    {FAMILLES_ACTIVITE.map((f) => (
                      <td
                        key={f}
                        className={`px-3 py-2.5 text-right tabular-nums ${
                          j.compteurs[f] === 0 ? 'font-medium text-text-muted' : 'font-bold text-text-strong'
                        }`}
                      >
                        {j.compteurs[f]}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-black/15">
                <th scope="row" className="px-3 py-2.5 text-left font-bold text-text-strong">
                  Total
                </th>
                {totaux.map(({ famille, total }) => (
                  <td
                    key={famille}
                    className="px-3 py-2.5 text-right font-bold tabular-nums text-text-strong"
                  >
                    {total}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      ) : null}
    </section>
  );
}

function CalendrierJour({
  selection,
  aujourdhui,
  onChoisir,
}: {
  selection: string;
  aujourdhui: string;
  onChoisir: (jour: string) => void;
}) {
  const ancre = parseIsoDate(selection) ?? new Date();
  const [vue, setVue] = useState(() => startOfMonth(ancre));
  const cells = useMemo(() => buildMonthCells(vue), [vue]);

  return (
    <div
      role="dialog"
      aria-label="Choisir un jour"
      className="absolute left-0 top-[calc(100%+8px)] z-30 w-[280px] rounded-clay-lg border border-black/12 bg-white p-2 shadow-clay"
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
        <p className="text-[13.5px] font-semibold capitalize text-text-strong">{moisLabel(vue)}</p>
        <button
          type="button"
          onClick={() => setVue((d) => addMonths(d, 1))}
          aria-label="Mois suivant"
          className="flex size-9 items-center justify-center rounded-lg text-text-strong hover:bg-black/[0.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <ChevronRight size={18} aria-hidden />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 px-1 pb-1">
        {JOURS_CAL.map((j) => (
          <span key={j} className="py-1 text-center text-[10.5px] font-semibold uppercase" style={{ color: FIELD.ardoise }}>
            {j}
          </span>
        ))}
        {cells.map(({ iso, inMonth }) => {
          const futur = iso > aujourdhui;
          const actif = iso === selection;
          const auj = iso === aujourdhui;
          return (
            <button
              key={iso}
              type="button"
              disabled={!inMonth || futur}
              onClick={() => inMonth && !futur && onChoisir(iso)}
              aria-pressed={actif}
              className={`flex size-8 items-center justify-center rounded-lg text-[12.5px] tabular-nums ${
                !inMonth
                  ? 'cursor-default text-transparent'
                  : futur
                    ? 'cursor-default text-text-subtle'
                    : actif
                      ? 'font-semibold text-white'
                      : auj
                        ? 'font-semibold text-text-strong ring-1 ring-inset ring-[#3D5A80]/40'
                        : 'font-medium text-text-strong hover:bg-[#FFF7F0]'
              }`}
              style={actif && inMonth && !futur ? { backgroundColor: FIELD.ardoise } : undefined}
              aria-label={
                inMonth && !futur
                  ? new Intl.DateTimeFormat('fr-FR', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    }).format(parseIsoDate(iso)!)
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
          onClick={() => onChoisir(aujourdhui)}
          className="min-h-9 w-full rounded-lg text-[12.5px] font-semibold hover:bg-[#FFF7F0] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          style={{ color: FIELD.ardoise }}
        >
          Aujourd&apos;hui
        </button>
      </div>
    </div>
  );
}
