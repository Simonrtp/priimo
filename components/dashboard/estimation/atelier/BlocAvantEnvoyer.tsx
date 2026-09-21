'use client';

import { ChevronRight } from 'lucide-react';
import type { EtapeAtelierId } from '@/lib/estimation/etapes';
import type { ManqueEnvoi } from '@/lib/rapport/avant-envoyer';

export default function BlocAvantEnvoyer({
  manques,
  onAllerA,
}: {
  manques: ManqueEnvoi[];
  onAllerA: (etape: EtapeAtelierId) => void;
}) {
  return (
    <aside className="rounded-clay border border-black/[0.06] bg-surface p-4">
      <h2 className="text-[14px] font-semibold text-text-strong">Avant d’envoyer</h2>
      <p className="mt-1 text-pretty text-[13px] text-text-muted">
        Rappel de ce qui manque encore. Rien n’empêche l’envoi.
      </p>
      {manques.length === 0 ? (
        <p className="mt-3 text-pretty text-[13.5px] text-text">
          L’essentiel est en place. Relisez le rapport avant de l’envoyer.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-1">
          {manques.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => onAllerA(m.etape)}
                className="flex w-full min-h-11 items-center justify-between gap-2 rounded-clay px-2 py-2 text-left text-[13.5px] text-text hover:bg-black/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <span>{m.label}</span>
                <ChevronRight size={16} strokeWidth={2} className="shrink-0 text-[#E8743C]" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
