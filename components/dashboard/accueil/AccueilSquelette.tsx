import { ChevronDown, Filter } from 'lucide-react';
import { COULEUR_FAMILLE } from '@/lib/activite/couleurs';
import { FAMILLES_ACTIVITE, LIBELLE_ACTIVITE } from '@/lib/activite/types';
import { ACCUEIL, FIELD } from '@/lib/today/field';
import { EmploiDuTempsSquelette } from './EmploiDuTemps';

const OBJECTIF = {
  teinte: '#7C4DD3',
  pastelFort: '#DCCFF7',
  pastille: '#EBE3FA',
  voile: '#F5F1FD',
} as const;

const MANDAT = { pastelFort: '#D5EADF' } as const;

const ILLUSTRATION: Record<(typeof FAMILLES_ACTIVITE)[number], string> = {
  contacts_physiques: '/porte-ouverte.png',
  immeubles_prospectes: '/bureau.png',
  contacts_qualifies: '/contact.png',
  estimations: '/calculatrice.png',
  informations_terrain: '/info.png',
};

function Trait({ className }: { className: string }) {
  return <div className={`squelette ${className}`} />;
}

/**
 * Le chargement de l’Accueil : les vraies cartes, sans les chiffres.
 * Même chrome, mêmes couleurs, même grille — seuls les nombres balayent.
 */
export default function AccueilSquelette({ mobile }: { mobile: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Chargement de l’accueil</span>

      <section className="max-md:hidden rounded-clay-lg bg-surface p-5 shadow-clay sm:p-6">
        <div className="flex items-start gap-3.5">
          <span className="squelette mt-0.5 size-9 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2.5 pt-0.5">
            <Trait className="h-7 w-[min(100%,28rem)] rounded-md sm:h-8" />
            <Trait className="h-7 w-[min(72%,18rem)] rounded-md sm:h-8" />
          </div>
        </div>
      </section>

      <section
        className="flex flex-col gap-4 rounded-clay-lg px-5 py-4 shadow-clay-sm sm:flex-row sm:items-center sm:gap-8"
        style={{ backgroundColor: OBJECTIF.voile }}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span
            aria-hidden
            className="relative flex size-12 shrink-0 items-center justify-center rounded-[14px]"
            style={{ backgroundColor: OBJECTIF.pastelFort }}
          >
            <img src="/cibles.png" alt="" width={36} height={36} className="size-9" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[12px] font-semibold text-text-muted">Objectif de la période</p>
              <Trait className="h-5 w-10 rounded" />
            </div>
            <div
              className="mt-2 h-2 w-full overflow-hidden rounded-full"
              style={{ backgroundColor: OBJECTIF.pastille }}
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="relative flex size-12 shrink-0 items-center justify-center rounded-[14px]"
            style={{ backgroundColor: MANDAT.pastelFort }}
          >
            <img src="/validation.png" alt="" width={36} height={36} className="size-9" />
          </span>
          <div className="min-w-0">
            <p className="text-[12px] font-semibold text-text-muted">Mandats ce mois</p>
            <Trait className="mt-1.5 h-5 w-16 rounded" />
          </div>
        </div>
      </section>

      <ul className="grid grid-cols-2 items-stretch gap-3 lg:grid-cols-5">
        {FAMILLES_ACTIVITE.map((famille) => {
          const couleur = COULEUR_FAMILLE[famille];
          return (
            <li
              key={famille}
              className="flex flex-col rounded-clay-lg p-4 shadow-clay-sm"
              style={{ backgroundColor: couleur.voile }}
            >
              <div className="flex items-center gap-2.5 lg:block">
                <span
                  aria-hidden
                  className="relative flex size-12 shrink-0 items-center justify-center rounded-[14px]"
                  style={{ backgroundColor: couleur.pastelFort }}
                >
                  <img
                    src={ILLUSTRATION[famille]}
                    alt=""
                    width={36}
                    height={36}
                    className="size-9"
                  />
                </span>
                <Trait className="h-7 w-16 rounded lg:hidden" />
              </div>
              <p className="mt-2 text-[12px] font-semibold leading-tight text-text-strong lg:mt-3">
                {LIBELLE_ACTIVITE[famille]}
              </p>
              <Trait className="mt-2 hidden h-7 w-16 rounded lg:block" />
              <div
                className="mt-3 h-2.5 w-full overflow-hidden rounded-full"
                style={{ backgroundColor: couleur.pastille }}
              />
            </li>
          );
        })}
      </ul>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
        <section className="flex min-h-[240px] flex-col rounded-clay-lg bg-surface p-5 shadow-clay">
          <h2 className="font-display text-[15px] font-bold text-text-strong">
            Mes nouvelles adresses
          </h2>
          <ul className="mt-3 flex flex-1 flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <li
                key={i}
                className="flex items-center gap-3 rounded-clay bg-surface-2 px-3 py-2.5"
              >
                <span
                  aria-hidden
                  className="flex size-8 shrink-0 items-center justify-center rounded-[10px]"
                  style={{ backgroundColor: '#FFE0C4', color: FIELD.orange }}
                />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Trait className="h-3.5 w-3/4 rounded" />
                  <Trait className="h-3 w-1/3 rounded" />
                </div>
              </li>
            ))}
          </ul>
        </section>
        <EmploiDuTempsSquelette />
      </div>

      {mobile ? null : (
        <section className="flex min-h-0 flex-col rounded-clay-lg bg-surface p-5 shadow-clay sm:p-6">
          <div className="flex items-center gap-2">
            <Filter size={16} strokeWidth={2.4} className="shrink-0 text-blue-dark" aria-hidden />
            <h2 className="font-display text-[16px] font-bold leading-tight text-blue-dark sm:text-[17px]">
              Mon entonnoir de conversion
            </h2>
          </div>
          <div className="mt-5 grid min-h-0 flex-1 gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(240px,0.85fr)]">
            <div className="grid grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] items-center gap-4 sm:gap-6">
              <div className="mx-auto flex w-full max-w-[220px] flex-col items-center gap-2 py-2">
                <Trait className="h-14 w-[90%] rounded-md" />
                <Trait className="h-14 w-[72%] rounded-md" />
                <Trait className="h-14 w-[54%] rounded-md" />
                <Trait className="h-14 w-[38%] rounded-md" />
              </div>
              <ul className="flex flex-col justify-center gap-5">
                {[0, 1, 2, 3].map((i) => (
                  <li key={i} className="flex items-center justify-between gap-3">
                    <Trait className="h-3.5 w-32 rounded" />
                    <Trait className="h-3.5 w-10 rounded" />
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col justify-center gap-4 rounded-clay bg-surface-2 p-4">
              {[0, 1, 2].map((i) => (
                <Trait key={i} className="h-10 w-full rounded-clay" />
              ))}
            </div>
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-5 lg:items-stretch lg:gap-8">
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-3">
          {[0, 1, 2].map((i) => (
            <section
              key={i}
              className="flex items-center gap-3 rounded-clay-lg bg-surface p-4 shadow-clay"
            >
              <span className="squelette size-9 shrink-0 rounded-clay" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Trait className="h-3 w-24 rounded" />
                <Trait className="h-4 w-2/3 rounded" />
              </div>
            </section>
          ))}
        </div>
        <section className="flex min-h-[200px] flex-col rounded-clay-lg bg-surface px-4 py-4 shadow-clay sm:px-5 sm:py-5 lg:col-span-2">
          <p className="font-semibold uppercase" style={{ fontSize: 11, color: FIELD.ardoise }}>
            Dernières notes
          </p>
          <ul className="mt-3 flex flex-col">
            {[0, 1, 2].map((i) => (
              <li key={i} className="border-b border-black/[0.06] py-3 last:border-b-0">
                <Trait className="h-3.5 w-2/3 rounded" />
                <Trait className="mt-2 h-3 w-1/3 rounded" />
              </li>
            ))}
          </ul>
        </section>
      </div>

      {mobile ? null : (
        <section className="flex items-center gap-2 rounded-clay-lg bg-surface px-4 py-3.5 shadow-clay-sm">
          <span className="font-display text-[15px] font-bold text-text-strong">
            Mon activité du jour
          </span>
          <ChevronDown size={17} strokeWidth={2.2} className="ml-auto shrink-0 text-text-muted" aria-hidden />
        </section>
      )}

      <section className="flex items-center gap-6 rounded-clay-lg bg-surface p-5 shadow-clay">
        <div className="min-w-0 flex-1 space-y-3">
          <Trait className="h-4 w-48 rounded" />
          <Trait className="h-5 w-[min(100%,22rem)] rounded" />
          <Trait className="h-3 w-full max-w-md rounded" />
          <Trait className="h-3 w-4/5 max-w-sm rounded" />
          <Trait className="mt-2 h-[42px] w-40 rounded-clay" />
        </div>
        <div className="squelette mr-3 hidden size-[152px] shrink-0 rounded-clay sm:block" />
      </section>
    </div>
  );
}

/** En-tête figé pendant le chargement : même rangée que `EnteteSemaine`. */
export function EnteteSquelette({
  titre,
  intervalle,
  periodeActive,
}: {
  titre: string;
  intervalle: string;
  periodeActive: 'jour' | 'semaine' | 'mois' | 'annee';
}) {
  const periodes = [
    ['jour', 'Jour'],
    ['semaine', 'Semaine'],
    ['mois', 'Mois'],
    ['annee', 'Année'],
  ] as const;

  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
      <div
        className="w-full rounded-clay-lg px-3.5 py-2 shadow-clay-sm sm:w-[15.5rem] sm:shrink-0"
        style={{ backgroundColor: ACCUEIL.creme }}
        aria-hidden
      >
        <p className="text-[11px] font-semibold text-text-muted">Pense-bête</p>
        <Trait className="mt-1.5 h-4 w-4/5 rounded" />
      </div>
      <div className="hidden shrink-0 sm:block">
        <h1 className="text-balance font-display text-[17px] font-bold leading-tight text-text-strong sm:text-[19px]">
          {titre}
        </h1>
        <p className="mt-0.5 text-[13px] text-text-muted">{intervalle}</p>
      </div>
      <div className="flex items-center justify-end gap-2 sm:order-last sm:ml-auto">
        <div className="flex rounded-clay bg-surface-2 p-1 shadow-clay-inset">
          {periodes.map(([id, libelle]) => (
            <span
              key={id}
              className={`rounded-[12px] px-2.5 py-1.5 text-[12px] font-semibold ${
                id === periodeActive
                  ? 'bg-surface text-text-strong shadow-clay-sm'
                  : 'text-text-muted'
              }`}
            >
              {libelle}
            </span>
          ))}
        </div>
      </div>
    </header>
  );
}
