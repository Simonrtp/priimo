'use client';

import { useCallback, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import PageRapport from '@/components/rapport/PageRapport';
import ApercuPageComposee from '@/components/rapport/ApercuPageComposee';
import {
  normaliserCouleurPrincipale,
  type IdentiteAgenceRapport,
  type IdentiteAgentRapport,
  type PiedBienRapport,
} from '@/lib/rapport/identite';
import type { PageRapportComposee } from '@/lib/rapport/pages';
import type { DossierRapport } from '@/lib/rapport/genere/types';

export default function ModePresentationRapport({
  pages,
  index,
  onIndex,
  onFermer,
  agence,
  agent,
  bien,
  dateIso,
  dossier,
}: {
  pages: PageRapportComposee[];
  index: number;
  onIndex: (index: number) => void;
  onFermer: () => void;
  agence: IdentiteAgenceRapport;
  agent: IdentiteAgentRapport;
  bien: PiedBienRapport;
  dateIso: string | null;
  dossier?: DossierRapport | null;
}) {
  const debutX = useRef<number | null>(null);
  const fermerRef = useRef<HTMLButtonElement>(null);
  const max = pages.length;
  const courant = Math.min(Math.max(0, index), Math.max(0, max - 1));

  const aller = useCallback(
    (delta: number) => {
      if (max < 1) return;
      onIndex(Math.min(max - 1, Math.max(0, courant + delta)));
    },
    [courant, max, onIndex],
  );

  useEffect(() => {
    const precedent = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onFermer();
        return;
      }
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        aller(1);
      }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        aller(-1);
      }
    }
    window.addEventListener('keydown', onKey);
    fermerRef.current?.focus();
    return () => {
      document.body.style.overflow = precedent;
      window.removeEventListener('keydown', onKey);
    };
  }, [aller, onFermer]);

  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType === 'touch' || e.pointerType === 'pen') {
      debutX.current = e.clientX;
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    const start = debutX.current;
    debutX.current = null;
    if (start != null && (e.pointerType === 'touch' || e.pointerType === 'pen')) {
      const dx = e.clientX - start;
      if (dx <= -48) aller(1);
      else if (dx >= 48) aller(-1);
      return;
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    aller(x < rect.width * 0.35 ? -1 : 1);
  }

  const page = pages[courant] ?? null;
  const accent = normaliserCouleurPrincipale(agence.couleurPrincipale);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-[#1A1714]/95"
      role="dialog"
      aria-modal="true"
      aria-label="Présentation du rapport"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-3">
        <p className="text-[13px] tabular-nums text-white/80">
          {max > 0 ? `${courant + 1} / ${max}` : 'Aucune page'}
        </p>
        <button
          ref={fermerRef}
          type="button"
          onClick={onFermer}
          className="inline-flex min-h-11 items-center gap-2 rounded-clay px-3 text-[13.5px] font-semibold text-white hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <X size={16} strokeWidth={2} aria-hidden />
          Quitter
        </button>
      </div>

      <div
        className="flex min-h-0 flex-1 items-center justify-center px-3 pb-4 sm:px-8"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      >
        <div className="w-full max-w-5xl pointer-events-none">
          <PageRapport
            agence={agence}
            agent={agent}
            bien={bien}
            dateIso={dateIso}
            page={max === 0 ? 1 : courant + 1}
            pages={Math.max(max, 1)}
            sansChrome={page?.kind === 'generee'}
          >
            <ApercuPageComposee page={page} accent={accent} dossier={dossier} />
          </PageRapport>
        </div>
      </div>

      {max > 1 ? (
        <div className="flex shrink-0 items-center justify-center gap-3 pb-5">
          <button
            type="button"
            className="inline-flex size-11 items-center justify-center rounded-clay bg-white/10 text-white hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-40"
            aria-label="Page précédente"
            disabled={courant === 0}
            onClick={() => aller(-1)}
          >
            <ChevronLeft size={20} strokeWidth={2} aria-hidden />
          </button>
          <button
            type="button"
            className="inline-flex size-11 items-center justify-center rounded-clay bg-white/10 text-white hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-40"
            aria-label="Page suivante"
            disabled={courant >= max - 1}
            onClick={() => aller(1)}
          >
            <ChevronRight size={20} strokeWidth={2} aria-hidden />
          </button>
        </div>
      ) : null}
    </div>
  );
}
