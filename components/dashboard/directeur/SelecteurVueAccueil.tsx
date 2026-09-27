'use client';

import { useRouter } from 'next/navigation';
import { ACCUEIL_VUE_COOKIE, type AccueilVue } from '@/lib/today/accueil-vue';

function writeCookie(vue: AccueilVue) {
  const maxAge = 60 * 60 * 24 * 400;
  document.cookie = `${ACCUEIL_VUE_COOKIE}=${encodeURIComponent(vue)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

/** Sélecteur Mon équipe / Ma semaine — seul écart d'écran lié au rôle directeur. */
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
    <div
      className="inline-flex w-fit shrink-0 rounded-full border border-black/[0.08] bg-white p-1 shadow-clay-sm"
      role="tablist"
      aria-label="Vue d'accueil"
    >
      {(
        [
          { id: 'directeur' as const, label: 'Mon équipe' },
          { id: 'agent' as const, label: 'Ma semaine' },
        ] as const
      ).map((opt) => {
        const actif = vue === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={actif}
            onClick={() => choisir(opt.id)}
            className={`min-h-9 rounded-full px-3.5 text-[13px] font-semibold transition-colors ${
              actif
                ? 'bg-[#1a2a56] text-white'
                : 'text-text-muted hover:text-text'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
