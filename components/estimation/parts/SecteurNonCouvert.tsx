'use client';

import { useState } from 'react';
import WorkspaceButton from '@/components/dashboard/workspace/WorkspaceButton';
import { toast } from 'sonner';

/**
 * Écran dédié quand le secteur n’a ni ventes DVF ni référentiel CP.
 * Bouton de signalement : écrit une ligne consultable (info commerciale).
 */
export default function SecteurNonCouvert({
  postalCode,
  city,
  address,
  onRestart,
}: {
  postalCode: string;
  city: string | null;
  address: string;
  onRestart: () => void;
}) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function signaler() {
    setSending(true);
    try {
      const res = await fetch('/api/dashboard/estimation/coverage-demand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postalCode, city, address }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? 'La demande n’a pas pu être enregistrée. Réessayez.');
        return;
      }
      setSent(true);
      toast.success('Demande enregistrée');
    } catch {
      toast.error('Envoi impossible pour le moment');
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="flex flex-col gap-5 rounded-clay border border-black/[0.06] bg-surface p-5 shadow-clay-sm">
      <div>
        <h2 className="text-balance text-[18px] font-semibold text-ink">Secteur non couvert</h2>
        <p className="mt-3 text-pretty text-[14px] leading-relaxed text-text-muted">
          Ce secteur n’est pas encore couvert par nos données de ventes. Nous chargeons actuellement
          Paris et la Haute-Savoie.
        </p>
        {postalCode ? (
          <p className="mt-2 text-[13px] text-text-subtle">
            Code postal concerné : <span className="tabular-nums font-medium text-ink">{postalCode}</span>
            {city ? ` · ${city}` : ''}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <WorkspaceButton type="button" onClick={() => void signaler()} disabled={sending || sent}>
          {sent ? 'Demande enregistrée' : 'Signaler cette demande'}
        </WorkspaceButton>
        <button
          type="button"
          onClick={onRestart}
          className="rounded-lg border border-black/10 bg-white px-3 py-2 text-[13px] font-medium text-ink hover:bg-black/[0.03]"
        >
          Autre adresse
        </button>
      </div>
    </section>
  );
}
