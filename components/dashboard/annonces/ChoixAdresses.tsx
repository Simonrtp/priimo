'use client';

import { Check, Undo2 } from 'lucide-react';
import { NumeroPossible } from './AnnoncesAjoutees';
import IndiceSurete from './IndiceSurete';
import type { AdressePossible } from '@/lib/annonces/types';

/**
 * Les deux ou trois adresses possibles d'une annonce, groupées : une seule est
 * la bonne. Toucher une adresse la choisit (les autres s'estompent), la toucher
 * à nouveau ou « Annuler » revient à toutes. Chacune dit pourquoi elle est là.
 */
export default function ChoixAdresses({
  possibles,
  choisie,
  onChoisir,
  occupe = false,
}: {
  possibles: readonly AdressePossible[];
  /** L'adresse choisie, ou null : toutes restent liées. */
  choisie: string | null;
  onChoisir: (adresse: string | null) => void;
  occupe?: boolean;
}) {
  const n = possibles.length;
  return (
    <div className="flex flex-col gap-1.5">
      <p className="flex min-h-6 items-center gap-2 text-[12px] font-medium text-text-subtle">
        <span className="min-w-0 flex-1">{n > 1 ? `${n} adresses possibles` : 'Adresse possible'}</span>
        {choisie ? (
          <button
            type="button"
            onClick={() => onChoisir(null)}
            disabled={occupe}
            className="inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[11.5px] font-semibold text-text-muted hover:bg-black/[0.05] hover:text-text-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1A2A56] disabled:opacity-60"
          >
            <Undo2 size={12} strokeWidth={2.4} aria-hidden />
            Annuler
          </button>
        ) : (
          <IndiceSurete confiance="incertaine" nbPossibles={n} />
        )}
      </p>
      <ol className="overflow-hidden rounded-[14px] bg-white ring-1 ring-black/[0.07]">
        {possibles.map((p, i) => {
          const elue = choisie === p.adresse;
          const estompee = choisie != null && !elue;
          return (
            <li key={p.adresse} className="border-t border-black/[0.05] first:border-t-0">
              <button
                type="button"
                aria-pressed={elue}
                disabled={occupe}
                onClick={() => onChoisir(elue ? null : p.adresse)}
                className={`flex w-full items-start gap-2 px-2.5 py-2 text-left transition-[background-color,opacity] duration-fluid-subtle focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#1A2A56] disabled:cursor-default ${
                  elue ? 'bg-[#EEF0FA]' : estompee ? 'opacity-45 hover:opacity-80' : 'hover:bg-black/[0.03]'
                }`}
              >
                <span className="mt-px">
                  <NumeroPossible n={i + 1} etat={elue ? 'choisie' : undefined} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-text-strong">{p.adresse.replace(/\s\d{5}\s.*$/, '')}</span>
                  {p.raison ? <span className="block text-[11.5px] leading-snug text-text-muted">{p.raison}</span> : null}
                </span>
                {elue ? <Check size={15} strokeWidth={2.4} aria-hidden className="mt-0.5 shrink-0 text-[#1A2A56]" /> : null}
              </button>
            </li>
          );
        })}
      </ol>
      {n > 1 && !choisie ? (
        <p className="px-1 text-[11.5px] leading-snug text-text-muted">Une seule est la bonne : touchez-la si vous la connaissez.</p>
      ) : null}
    </div>
  );
}
