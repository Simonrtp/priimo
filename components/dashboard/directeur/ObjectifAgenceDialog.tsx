'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import { OBJECTIF_MAX } from '@/lib/activite/objectifs';
import { validerEnFond } from '@/lib/ui/valider-en-fond';

const CHAMP =
  'w-24 shrink-0 rounded-lg border border-black/10 px-3 py-2 text-right text-[15px] font-semibold tabular-nums text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25';

function nombre(valeur: string): number {
  const n = Number.parseInt(valeur.replace(/[^\d]/g, ''), 10);
  if (!Number.isFinite(n)) return 0;
  return Math.min(OBJECTIF_MAX, Math.max(0, n));
}

/** Régler l'objectif mensuel de mandats de l'agence. */
export default function ObjectifAgenceDialog({
  initial,
  onClose,
  onEnregistre,
}: {
  initial: number;
  onClose: () => void;
  onEnregistre: () => void;
}) {
  const [valeur, setValeur] = useState(initial);

  function valider() {
    const corps = JSON.stringify({ objectifMandatsMois: valeur });
    onClose();

    validerEnFond({
      succes: "Objectif d'agence enregistré",
      echec: "L'objectif d'agence n'a pas pu être enregistré.",
      ecrire: async () => {
        const res = await fetch('/api/dashboard/objectif-agence', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: corps,
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(data?.error ?? "L'objectif d'agence n'a pas pu être enregistré.");
        }
      },
      puis: onEnregistre,
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Objectif d'équipe"
      description="Combien de mandats l'agence doit-elle signer ce mois ?"
      maxWidth="sm"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          valider();
        }}
        className="flex flex-col gap-5"
      >
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="relative flex size-12 shrink-0 items-center justify-center rounded-[14px]"
            style={{ backgroundColor: '#DCCFF7' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/cibles.png" alt="" width={36} height={36} className="size-9 object-contain" />
          </span>
          <label htmlFor="objectif-agence-mandats" className="min-w-0 flex-1 text-[13.5px] font-medium text-ink">
            Mandats ce mois
          </label>
          <input
            id="objectif-agence-mandats"
            type="text"
            inputMode="numeric"
            className={CHAMP}
            value={String(valeur)}
            onChange={(e) => setValeur(nombre(e.target.value))}
            autoFocus
          />
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-[13px] font-semibold text-text-muted hover:text-text-strong"
          >
            Annuler
          </button>
          <button
            type="submit"
            className="rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-white shadow-clay-sm transition-transform hover:-translate-y-px"
          >
            Valider
          </button>
        </div>
      </form>
    </Modal>
  );
}
