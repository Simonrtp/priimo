'use client';

import { useState } from 'react';
import type { motifRestriction } from '@/lib/billing/acces';

const TEXTES: Record<NonNullable<ReturnType<typeof motifRestriction>>, string> = {
  en_attente: '',
  refusee: '',
  essai: 'L’essai est terminé. La lecture de vos données reste ouverte. La livraison, l’estimation et la captation sont en pause.',
  impaye: 'Le dernier paiement n’est pas passé. Vos données restent accessibles. La livraison et la captation sont en pause.',
  resilie: 'L’abonnement est résilié. Vos données restent accessibles. La livraison et la captation sont en pause.',
};

export default function BandeauAbonnement({
  motif,
  directeur,
}: {
  motif: 'essai' | 'impaye' | 'resilie';
  directeur: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function payer() {
    setBusy(true);
    setErreur(null);
    try {
      const res = await fetch('/api/dashboard/abonnement/checkout', { method: 'POST' });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setErreur(data.error ?? 'Paiement indisponible pour le moment.');
        return;
      }
      window.location.assign(data.url);
    } catch {
      setErreur('Paiement indisponible pour le moment.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-clay-lg bg-white px-4 py-3.5 shadow-clay">
      <p className="text-pretty text-[14px] text-ink">{TEXTES[motif]}</p>
      {directeur ? (
        <div className="mt-2.5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void payer()}
            disabled={busy}
            className="inline-flex min-h-[36px] items-center rounded-clay bg-ink px-3.5 text-[13px] font-semibold text-white disabled:opacity-60"
          >
            {busy ? 'Ouverture…' : 'Régler l’abonnement'}
          </button>
          {erreur ? <p className="text-[13px] text-red-700">{erreur}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
