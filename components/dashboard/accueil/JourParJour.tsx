'use client';

import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { COULEUR_FAMILLE } from '@/lib/activite/couleurs';
import type { JourActivite } from '@/lib/activite/bilan';
import { FAMILLES_ACTIVITE, LIBELLE_ACTIVITE } from '@/lib/activite/types';

const COURT: Record<(typeof FAMILLES_ACTIVITE)[number], string> = {
  contacts_physiques: 'Contacts',
  immeubles_prospectes: 'Immeubles',
  contacts_qualifies: 'Qualifiés',
  estimations: 'Estim.',
  informations_terrain: 'Infos',
};

function jourCourt(cle: string): string {
  const [y, m, d] = cle.split('-').map(Number);
  const date = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1, 12));
  return date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', timeZone: 'UTC' });
}

/**
 * Le détail jour par jour, replié par défaut.
 *
 * C'est de la consultation, pas du pilotage : il n'a aucune raison d'occuper
 * de la hauteur tant qu'on ne l'a pas demandé. Masqué en mobile.
 */
export default function JourParJour({ jours }: { jours: readonly JourActivite[] }) {
  const [ouvert, setOuvert] = useState(false);
  if (jours.length === 0) return null;

  const totaux = FAMILLES_ACTIVITE.map((f) => ({
    famille: f,
    total: jours.reduce((s, j) => s + j.compteurs[f], 0),
  }));

  return (
    <section className="max-md:hidden">
      <button
        type="button"
        onClick={() => setOuvert((v) => !v)}
        aria-expanded={ouvert}
        className="flex w-full items-center justify-between gap-3 rounded-clay-lg bg-surface px-5 py-3.5 text-left shadow-clay-sm transition-shadow duration-fluid-subtle hover:shadow-clay"
      >
        <span className="font-display text-[15px] font-bold text-text-strong">
          Mon activité jour par jour
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

      {ouvert ? (
        <div className="mt-2 overflow-x-auto rounded-clay-lg bg-surface p-2 shadow-clay-sm">
          <table className="w-full min-w-[520px] border-collapse text-[12px]">
            <caption className="sr-only">
              Activité par jour et par famille sur la période affichée
            </caption>
            <thead>
              <tr>
                <th scope="col" className="px-3 py-2 text-left font-semibold text-text-muted">
                  Jour
                </th>
                {FAMILLES_ACTIVITE.map((f) => (
                  <th
                    key={f}
                    scope="col"
                    className="px-3 py-2 text-right font-semibold text-text-muted"
                    title={LIBELLE_ACTIVITE[f]}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        aria-hidden
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: COULEUR_FAMILLE[f].teinte }}
                      />
                      {COURT[f]}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {jours.map((j) => (
                <tr key={j.jour} className="border-t border-black/[0.05]">
                  <th scope="row" className="px-3 py-2 text-left font-medium text-text">
                    {jourCourt(j.jour)}
                  </th>
                  {FAMILLES_ACTIVITE.map((f) => (
                    <td
                      key={f}
                      className={`px-3 py-2 text-right tabular-nums ${
                        j.compteurs[f] === 0 ? 'text-text-subtle' : 'font-semibold text-text-strong'
                      }`}
                    >
                      {j.compteurs[f]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-black/[0.08]">
                <th scope="row" className="px-3 py-2 text-left font-bold text-text-strong">
                  Total
                </th>
                {totaux.map(({ famille, total }) => (
                  <td
                    key={famille}
                    className="px-3 py-2 text-right font-bold tabular-nums text-text-strong"
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
