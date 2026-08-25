'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import type { SortiePlan, SortieProgress, SortieStop } from '@/lib/today/sortie';
import { FIELD } from '@/lib/today/field';
import WorkspaceButton from '@/components/dashboard/workspace/WorkspaceButton';
import ScoreRing from '@/components/dashboard/ScoreRing';

export default function SortieMode({
  plan,
  progress,
  onClose,
  onDone,
  onSkip,
  onDicter,
}: {
  plan: SortiePlan;
  progress: SortieProgress;
  onClose: () => void;
  onDone: (stop: SortieStop) => void;
  onSkip: (stop: SortieStop) => void;
  onDicter: (stop: SortieStop) => void;
}) {
  const done = new Set(progress.done);
  const skipped = new Set(progress.skipped);
  const active = plan.ordered.find((s) => !done.has(s.key) && !skipped.has(s.key)) ?? null;
  const finished = active === null;
  const n = plan.ordered.length;
  const doneCount = progress.done.length;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[90] flex flex-col bg-bg-base"
      role="dialog"
      aria-modal="true"
      aria-label="Sortie du jour"
    >
      <header className="flex flex-shrink-0 items-center justify-between border-b border-black/[0.06] px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          className="text-[14px] font-medium text-text-muted hover:text-text"
        >
          Quitter
        </button>
        <p className="tabular-nums text-[14px] font-semibold text-text-strong">
          {doneCount}/{n}
        </p>
        <span className="w-14" aria-hidden />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
        {finished ? (
          <div className="mx-auto max-w-lg text-center">
            <h2 className="text-balance text-[22px] font-semibold text-text-strong">
              Sortie terminée · {n} adresse{n > 1 ? 's' : ''}
            </h2>
            <WorkspaceButton type="button" className="mt-8 w-full" onClick={onClose}>
              Fermer
            </WorkspaceButton>
          </div>
        ) : (
          <div className="mx-auto max-w-xl">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-text-subtle">
              Adresse {plan.ordered.indexOf(active!) + 1} sur {n}
            </p>
            <h2 className="mt-2 text-balance text-[24px] font-semibold leading-snug text-text-strong">
              {active!.address}
            </h2>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <ScoreRing score={active!.score} size={44} />
              {active!.surfaceM2 ? (
                <span className="text-[14px] text-text-muted">{active!.surfaceM2} m²</span>
              ) : null}
              {active!.etage ? (
                <span className="text-[14px] text-text-muted">Étage {active!.etage}</span>
              ) : null}
            </div>

            {active!.mainSignalLabel ? (
              <p className="mt-3 text-[14px] text-text">{active!.mainSignalLabel}</p>
            ) : null}
            {active!.notes ? (
              <p className="mt-2 rounded-xl px-3 py-2 text-pretty text-[13.5px] text-text-muted" style={{ backgroundColor: FIELD.creme }}>
                {active!.notes}
              </p>
            ) : null}

            <div className="mt-8 flex flex-col gap-2">
              <WorkspaceButton type="button" onClick={() => onDicter(active!)}>
                Dicter ici
              </WorkspaceButton>
              <WorkspaceButton type="button" variant="secondary" onClick={() => onDone(active!)}>
                Marquer comme faite
              </WorkspaceButton>
              <button
                type="button"
                onClick={() => onSkip(active!)}
                className="min-h-[44px] text-[14px] font-medium text-text-muted hover:text-text"
              >
                Passer
              </button>
              <Link
                href={`/dashboard/prospection?lead=${active!.leadId}`}
                className="mt-2 text-center text-[13px] font-medium text-text-strong underline decoration-black/25"
              >
                Ouvrir la fiche
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
