'use client';

import { useRouter } from 'next/navigation';
import Pastilles from '@/components/ui/Pastilles';
import { ACCUEIL_VUE_COOKIE, type AccueilVue } from '@/lib/today/accueil-vue';

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

  function choisir(next: AccueilVue) {
    if (next === vue) return;
    writeCookie(next);
    router.refresh();
  }

  return (
    <Pastilles
      role="tablist"
      label="Vue d'accueil"
      value={vue}
      options={OPTIONS}
      onChange={choisir}
    />
  );
}
