'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';

export type MembreOption = { id: string; nom: string };

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

  return (
    <label className="flex items-center gap-2 text-[12px] font-semibold text-text-muted">
      <span>Collaborateur</span>
      <select
        value={selectionne}
        disabled={enCours}
        onChange={(e) => {
          const q = new URLSearchParams(params?.toString() ?? '');
          q.set('membre', e.target.value);
          startTransition(() => router.push(`/dashboard?${q.toString()}`, { scroll: false }));
        }}
        className="rounded-clay bg-surface px-3 py-2 text-[12px] font-semibold text-text-strong shadow-clay-sm outline-none transition focus-visible:ring-2 focus-visible:ring-primary-400 disabled:opacity-50"
      >
        {membres.map((m) => (
          <option key={m.id} value={m.id}>
            {m.nom}
          </option>
        ))}
      </select>
    </label>
  );
}
