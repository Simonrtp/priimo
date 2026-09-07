'use client';

import Link from 'next/link';
import { Navigation } from 'lucide-react';
import type { SortiePlan } from '@/lib/today/sortie';
import { formatDistance } from '@/lib/today/field';
import WorkspaceButton from '@/components/dashboard/workspace/WorkspaceButton';
import AccueilCard from './AccueilCard';

/**
 * Point d’accroche de la tournée du jour.
 * Une zone hebdomadaire pourra remplacer `plan` sans réécrire cette carte :
 * passer un `SortiePlan` (adresses + distance) suffit.
 */
export default function ZoneDuJourCard({
  plan,
  onStart,
}: {
  plan: SortiePlan | null;
  onStart: (plan: SortiePlan) => void;
}) {
  const n = plan?.ordered.length ?? 0;

  return (
    <AccueilCard accent="vert" className="text-ink">
      <p className="font-semibold uppercase text-ink/60" style={{ fontSize: 11, letterSpacing: '0.08em' }}>
        Sortie du jour
      </p>
      {plan ? (
        <>
          <p className="mt-2 text-balance text-[16px] font-semibold text-ink">
            {n} adresse{n > 1 ? 's' : ''}
          </p>
          <p className="mt-0.5 text-[13px] text-ink/65">
            {formatDistance(plan.distanceM)} à pied estimés
          </p>
          <WorkspaceButton type="button" className="mt-4 w-full" onClick={() => onStart(plan)}>
            <Navigation size={16} strokeWidth={2.2} aria-hidden />
            Ouvrir la tournée
          </WorkspaceButton>
        </>
      ) : (
        <>
          <p className="mt-2 text-pretty text-[13.5px] text-ink/65">
            Aucune adresse à travailler aujourd&apos;hui.
          </p>
          <Link
            href="/dashboard/prospection"
            className="mt-3 inline-block text-[13.5px] font-semibold text-ink underline decoration-black/25 underline-offset-2"
          >
            Voir la prospection
          </Link>
        </>
      )}
    </AccueilCard>
  );
}
