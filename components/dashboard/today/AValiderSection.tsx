'use client';

import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';
import type { AgencyAction } from '@/lib/automations/types';
import { ACCUEIL, ACCUEIL_DARK } from '@/lib/today/field';
import ActionsInbox from '@/components/dashboard/actions/ActionsInbox';

const APERCU = 3;

/**
 * Zone « À valider » de l'Accueil : la boîte de réception des veilles.
 * Elle garde sa place même vide — c'est ce qui la rend consultable d'un coup
 * d'œil chaque matin.
 */
export default function AValiderSection({
  actions,
  className = '',
}: {
  actions: readonly AgencyAction[];
  className?: string;
}) {
  const total = actions.length;
  const reste = Math.max(0, total - APERCU);

  return (
    <section
      aria-labelledby="accueil-a-valider"
      className={`rounded-[18px] p-4 text-ink sm:p-5 ${className}`}
      style={{ backgroundColor: ACCUEIL.creme }}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 items-center gap-2">
          <Sparkles size={15} strokeWidth={2.2} aria-hidden />
          <h2 id="accueil-a-valider" className="text-[15px] font-semibold tracking-tight">
            À valider
          </h2>
          {total > 0 ? (
            <span
              className="inline-flex min-w-[22px] items-center justify-center rounded-full px-1.5 py-0.5 text-[11.5px] font-semibold tabular-nums"
              style={{ backgroundColor: ACCUEIL_DARK.creme }}
            >
              {total}
            </span>
          ) : null}
        </div>

        {reste > 0 ? (
          <Link
            href="/dashboard/actions"
            className="inline-flex min-h-[32px] items-center gap-1 rounded-[10px] px-3 text-[12px] font-semibold text-ink transition-opacity duration-fluid-subtle ease-in-out hover:opacity-85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink/40"
            style={{ backgroundColor: ACCUEIL_DARK.creme }}
          >
            Voir les {reste} autres
            <ArrowRight size={14} strokeWidth={2.5} aria-hidden />
          </Link>
        ) : null}
      </div>

      <p className="mt-1 text-[12.5px] leading-relaxed text-ink/65">
        Ce que les veilles ont trouvé. Rien ne part vers un client sans votre validation.
      </p>

      <div className="mt-3">
        <ActionsInbox initial={actions} limit={APERCU} emptyVariant="slim" />
      </div>
    </section>
  );
}
