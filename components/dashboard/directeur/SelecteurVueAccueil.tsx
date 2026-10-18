'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import Pastilles from '@/components/ui/Pastilles';
import { ACCUEIL_VUE_COOKIE, type AccueilVue } from '@/lib/today/accueil-vue';
import SqueletteAgence from './SqueletteAgence';

function writeCookie(vue: AccueilVue) {
  const maxAge = 60 * 60 * 24 * 400;
  document.cookie = `${ACCUEIL_VUE_COOKIE}=${encodeURIComponent(vue)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

const OPTIONS = [
  { id: 'directeur' as const, label: "L'agence" },
  { id: 'agent' as const, label: 'Ma semaine' },
] as const;

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
