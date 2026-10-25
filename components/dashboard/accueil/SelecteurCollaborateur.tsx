'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import Select from '@/components/ui/Select';

export type MembreOption = {
  id: string;
  nom: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string | null;
};

/** Même hauteur que les pastilles L'agence / Ma semaine. */
const DECLENCHEUR =
  'flex w-[15.5rem] max-w-full items-center justify-between gap-1.5 rounded-[12px] border border-black/[0.08] bg-surface px-2.5 py-1.5 text-left text-[12px] font-semibold text-text-strong shadow-clay-sm outline-none transition-[color,background-color,border-color,box-shadow] duration-fluid-subtle ease-in-out hover:border-black/[0.12] focus-visible:border-[color:color-mix(in_srgb,var(--primary-400)_50%,transparent)] focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--primary-400)_25%,transparent)] disabled:cursor-not-allowed disabled:opacity-50';

/**
 * Réservé au directeur — la page ne le rend jamais pour un collaborateur, et
 * `canSeeActivityOf` refait le contrôle côté serveur. Le sélecteur n'est qu'un
 * confort : il ne décide rien.
 */
export default function SelecteurCollaborateur({
  membres,
  selectionne,
  moi,
}: {
  membres: readonly MembreOption[];
  selectionne: string;
  /** Semaine de la personne connectée, en tête de liste. */
  moi?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [enCours, startTransition] = useTransition();

  if (membres.length <= 1) return null;

  const options = [...membres]
    .sort((a, b) => {
      if (moi && a.id === moi) return -1;
      if (moi && b.id === moi) return 1;
      return a.nom.localeCompare(b.nom, 'fr');
    })
    .map((m) => ({
      value: m.id,
      label: moi && m.id === moi ? `${m.nom} (Moi)` : m.nom,
      avatar: {
        firstName: m.firstName ?? '',
        lastName: m.lastName ?? '',
        url: m.avatarUrl,
      },
    }));

  return (
    <Select
      aria-label="Semaine affichée"
      value={selectionne}
      options={options}
      disabled={enCours}
      triggerClassName={DECLENCHEUR}
      onChange={(id) => {
        const q = new URLSearchParams(params?.toString() ?? '');
        if (moi && id === moi) q.delete('membre');
        else q.set('membre', id);
        const qs = q.toString();
        startTransition(() => router.push(qs ? `/dashboard?${qs}` : '/dashboard', { scroll: false }));
      }}
    />
  );
}
