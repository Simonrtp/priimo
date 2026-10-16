'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import Pastilles from '@/components/ui/Pastilles';
import { PASTILLE_TRACK, pastilleClass } from '@/components/ui/pastille-classes';
import { LIBELLE_PERIODE, PRESETS_PERIODE } from '@/lib/activite/semaines';
import { ACCUEIL_VUE_COOKIE, type AccueilVue } from '@/lib/today/accueil-vue';

function writeCookie(vue: AccueilVue) {
  const maxAge = 60 * 60 * 24 * 400;
  document.cookie = `${ACCUEIL_VUE_COOKIE}=${encodeURIComponent(vue)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

const OPTIONS = [
  { id: 'directeur' as const, label: "L'agence" },
  { id: 'agent' as const, label: 'Ma semaine' },
] as const;

function SqueletteAgence() {
  return (
    <div className="flex w-full min-w-0 flex-col gap-4 pb-10" aria-busy="true">
      <span className="sr-only">Chargement de l’agence</span>
      <header className="flex flex-row flex-wrap items-center gap-2 sm:gap-4">
        <div className={PASTILLE_TRACK} aria-hidden>
          <span className={pastilleClass(true)}>L&apos;agence</span>
          <span className={pastilleClass(false)}>Ma semaine</span>
        </div>
        <h1 className="font-display text-[24px] font-bold leading-none tracking-[-0.01em] text-text-strong max-sm:sr-only">
          L&apos;agence
        </h1>
        <div className={`${PASTILLE_TRACK} ml-auto`} aria-hidden>
          {PRESETS_PERIODE.map((id) => (
            <span key={id} className={pastilleClass(id === '7j')}>
              {LIBELLE_PERIODE[id]}
            </span>
          ))}
        </div>
      </header>
      <section className="rounded-clay-lg bg-surface px-4 pb-4 pt-4 shadow-clay sm:px-5">
        <h2 className="mb-4 text-[15px] font-semibold text-text-strong sm:text-[16px]">L&apos;équipe</h2>
        <div className="flex gap-5">
          {['a', 'b', 'c'].map((id) => (
            <div key={id} className="flex w-[5.5rem] flex-col items-center gap-2">
              <div className="squelette size-20 rounded-full" />
              <div className="squelette h-3 w-14 rounded-full" />
            </div>
          ))}
        </div>
      </section>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <section className="min-h-64 rounded-clay-lg bg-surface p-4 shadow-clay">
          <div className="squelette h-52 w-full rounded-[24px]" />
        </section>
        <section className="rounded-clay-lg bg-surface px-4 pb-4 pt-4 shadow-clay sm:px-5">
          <h2 className="mb-3 text-[15px] font-semibold text-text-strong sm:text-[16px]">L&apos;agence ce mois</h2>
          <div className="squelette mb-3 h-16 w-full rounded-clay" />
          <div className="space-y-3">
            <div className="squelette h-4 w-full rounded-full" />
            <div className="squelette h-4 w-4/5 rounded-full" />
            <div className="squelette h-4 w-2/3 rounded-full" />
          </div>
        </section>
      </div>
    </div>
  );
}

/** Sélecteur L'agence / Ma semaine — seul écart d'écran lié au rôle directeur. */
export default function SelecteurVueAccueil({
  vue,
}: {
  vue: AccueilVue;
}) {
  const router = useRouter();
  const [chargementAgence, setChargementAgence] = useState(false);

  function choisir(next: AccueilVue) {
    if (next === vue) return;
    writeCookie(next);
    if (next === 'directeur') setChargementAgence(true);
    router.refresh();
  }

  const hote =
    chargementAgence && typeof document !== 'undefined'
      ? document.querySelector('[data-accueil]')?.parentElement
      : null;

  const amorce = hote
    ? createPortal(
        <div className="absolute inset-0 z-30 overflow-y-auto bg-bg-base p-6 lg:p-8">
          <SqueletteAgence />
        </div>,
        hote,
      )
    : null;

  return (
    <>
      {amorce}
      <Pastilles
        role="tablist"
        label="Vue d'accueil"
        value={vue}
        options={OPTIONS}
        onChange={choisir}
      />
    </>
  );
}
