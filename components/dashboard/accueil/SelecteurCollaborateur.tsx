'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import Select from '@/components/ui/Select';

export type MembreOption = { id: string; nom: string };

/** Même langage que les cartes de l'accueil : clay, ombre légère, pas de menu OS. */
const DECLENCHEUR =
  'flex min-w-[11rem] items-center justify-between gap-2 rounded-clay border border-black/[0.08] bg-surface px-3 py-2 text-left text-[12px] font-semibold text-text-strong shadow-clay-sm outline-none transition-[color,background-color,border-color,box-shadow] duration-fluid-subtle ease-in-out hover:border-black/[0.12] focus-visible:border-primary-400/50 focus-visible:ring-2 focus-visible:ring-primary-400/25 disabled:cursor-not-allowed disabled:opacity-50';

/**
 * Réservé au directeur — la page ne le rend jamais pour un collaborateur, et
 * `canSeeActivityOf` refait le contrôle côté serveur. Le sélecteur n'est qu'un
 * confort : il ne décide rien.
 */
export default function SelecteurCollaborateur({
  membres,
  selectionne,
}: {
  membres: readonly MembreOption[];
  selectionne: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [enCours, startTransition] = useTransition();

  if (membres.length <= 1) return null;

  const options = membres.map((m) => ({ value: m.id, label: m.nom }));

  return (
    <label className="flex items-center gap-2 text-[12px] font-semibold text-text-muted">
      <span>Collaborateur</span>
      <Select
        aria-label="Collaborateur"
        value={selectionne}
        options={options}
        disabled={enCours}
        triggerClassName={DECLENCHEUR}
        onChange={(id) => {
          const q = new URLSearchParams(params?.toString() ?? '');
          q.set('membre', id);
          startTransition(() => router.push(`/dashboard?${q.toString()}`, { scroll: false }));
        }}
      />
    </label>
  );
}
