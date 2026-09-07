'use client';

import { useMemo, useState } from 'react';
import { Inbox } from 'lucide-react';
import type { AgencyAction } from '@/lib/automations/types';
import WorkspaceCard from '@/components/dashboard/workspace/WorkspaceCard';
import ActionCard from './ActionCard';

export default function ActionsInbox({
  initial,
  limit,
  emptyVariant = 'full',
}: {
  initial: readonly AgencyAction[];
  /** Accueil : on ne montre que le haut de la pile, le reste vit sur sa page. */
  limit?: number;
  emptyVariant?: 'full' | 'slim';
}) {
  const [resolues, setResolues] = useState<Set<string>>(() => new Set());

  const visibles = useMemo(() => {
    const restantes = initial.filter((a) => !resolues.has(a.id));
    return limit ? restantes.slice(0, limit) : restantes;
  }, [initial, resolues, limit]);

  function marquerResolue(id: string) {
    setResolues((prev) => new Set(prev).add(id));
  }

  if (visibles.length === 0) {
    if (emptyVariant === 'slim') {
      return (
        <p className="text-[13.5px] leading-relaxed text-text-subtle">
          Rien à valider. Les veilles tournent chaque matin — dès qu&apos;un signal mérite votre
          attention, il apparaît ici.
        </p>
      );
    }
    return (
      <WorkspaceCard className="flex flex-col items-center py-14 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-clay bg-black/[0.04]">
          <Inbox size={24} className="text-text-subtle" strokeWidth={1.5} aria-hidden />
        </div>
        <p className="text-[15.5px] font-semibold text-text">Rien à valider</p>
        <p className="mt-2 max-w-md text-[13.5px] leading-relaxed text-text-subtle">
          Les veilles tournent chaque matin. Dès qu&apos;un signal mérite votre attention, il
          apparaît ici — jamais avant, jamais tout seul.
        </p>
      </WorkspaceCard>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {visibles.map((action) => (
        <ActionCard key={action.id} action={action} onResolue={marquerResolue} />
      ))}
    </div>
  );
}
