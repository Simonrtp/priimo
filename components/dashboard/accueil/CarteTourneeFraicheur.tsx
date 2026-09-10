'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';

export const CLE_TOURNEE_FRAICHEUR = 'tournee-fraicheur';

/**
 * Plus de 10 adresses dépassent le cycle : on propose une tournée, on n'insiste
 * pas. Refermable deux semaines.
 */
export default function CarteTourneeFraicheur({ aRevoir }: { aRevoir: number }) {
  const router = useRouter();
  const [masquee, setMasquee] = useState(false);

  if (masquee) return null;

  async function ecarter() {
    const jusqua = new Date();
    jusqua.setDate(jusqua.getDate() + 14);
    setMasquee(true);
    try {
      await fetch('/api/dashboard/today/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardKey: CLE_TOURNEE_FRAICHEUR,
          snoozedUntil: jusqua.toISOString(),
        }),
      });
    } catch {
      // L'écran a déjà refermé la carte. Un prochain chargement la ramènera.
    }
    router.refresh();
  }

  return (
    <section className="relative rounded-clay-lg bg-white px-4 py-3.5 shadow-clay">
      <button
        type="button"
        onClick={() => void ecarter()}
        aria-label="Refermer pour deux semaines"
        className="absolute right-2 top-2 rounded-lg p-1.5 text-mute transition-colors hover:bg-black/[0.04] hover:text-ink"
      >
        <X size={14} aria-hidden />
      </button>
      <p className="pr-8 text-pretty text-[14px] text-ink">
        {aRevoir} adresses n’ont pas été passées depuis trop longtemps.
      </p>
      <Link
        href="/dashboard/prospection?vue=carte&itineraire=1&fraicheur=a-revoir"
        className="mt-2 inline-flex text-[13px] font-medium text-primary-600 transition-colors hover:text-primary-700"
      >
        Construire une tournée
      </Link>
    </section>
  );
}

export function DessinerMonSecteur() {
  return (
    <section className="rounded-clay-lg bg-white px-4 py-3.5 shadow-clay">
      <h2 className="font-semibold text-ink" style={{ fontSize: 16 }}>
        Mon secteur
      </h2>
      <p className="mt-1 text-pretty text-[13px] text-mute">Aucun secteur dessiné.</p>
      <Link
        href="/dashboard/settings?tab=secteurs"
        className="mt-2 inline-flex text-[13px] font-medium text-primary-600 transition-colors hover:text-primary-700"
      >
        Dessiner mon secteur
      </Link>
    </section>
  );
}
