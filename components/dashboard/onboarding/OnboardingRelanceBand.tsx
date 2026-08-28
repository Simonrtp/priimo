'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';

/**
 * Reprise de la prise en main — une seule fois.
 *
 * Un onboarding abandonné ne se relance pas à chaque connexion : une bande
 * discrète, refermable définitivement, puis plus rien. Fermer la bande vaut
 * réponse, et cette réponse est enregistrée en base.
 */
export default function OnboardingRelanceBand({ minutes }: { minutes: number }) {
  const router = useRouter();
  const [masquee, setMasquee] = useState(false);

  function reprendre() {
    // Le paramètre rouvre le parcours là où il s'était arrêté.
    router.push('/dashboard?prise-en-main=1');
  }

  async function refuser() {
    setMasquee(true);
    try {
      await fetch('/api/dashboard/onboarding/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'refuser_relance' }),
      });
    } catch {
      /* la bande est déjà masquée pour cette session */
    }
    router.refresh();
  }

  if (masquee) return null;

  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-clay border border-black/[0.06] bg-surface px-4 py-2.5 shadow-clay-sm">
      <p className="min-w-0 text-[13.5px] text-ink">
        Reprendre la prise en main — {minutes} minute{minutes > 1 ? 's' : ''}
      </p>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={reprendre}
          className="rounded-lg border border-black/10 bg-white px-3 py-1.5 text-[13px] font-medium text-ink transition hover:bg-black/[0.03]"
        >
          Reprendre
        </button>
        <button
          type="button"
          onClick={() => void refuser()}
          aria-label="Ne plus proposer"
          className="rounded-lg p-1.5 text-text-subtle transition hover:bg-black/[0.04] hover:text-ink"
        >
          <X size={16} aria-hidden />
        </button>
      </div>
    </div>
  );
}
