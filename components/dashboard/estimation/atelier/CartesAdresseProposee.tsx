'use client';

import { MapPin } from 'lucide-react';
import {
  adresseDejaAppliquee,
  type AdresseProposee,
} from '@/lib/notes/rattacher-catalogue';

export default function CartesAdresseProposee({
  propositions,
  actuel,
  onChoisir,
}: {
  propositions: AdresseProposee[];
  actuel: { address?: string | null; bienId?: string | null };
  onChoisir: (p: AdresseProposee) => void;
}) {
  const visibles = propositions.filter((p) => !adresseDejaAppliquee(actuel, p));
  if (visibles.length === 0) return null;

  return (
    <ul className="flex flex-col gap-1.5">
      {visibles.map((p) => (
        <li key={p.key}>
          <button
            type="button"
            onClick={() => onChoisir(p)}
            className="flex min-h-11 w-fit max-w-sm items-start gap-2 rounded-xl border border-black/[0.08] bg-surface px-3 py-2 text-left hover:bg-black/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <MapPin size={15} strokeWidth={2} className="mt-0.5 shrink-0 text-text-muted" aria-hidden />
            <span className="min-w-0">
              <span className="block text-[12px] text-text-muted">
                {p.source === 'bien' ? 'Appartement' : 'Adresse du client'}
              </span>
              <span className="block text-pretty text-[13.5px] text-text-strong">{p.label}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
