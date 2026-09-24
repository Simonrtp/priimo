'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import WorkspaceButton from '@/components/dashboard/workspace/WorkspaceButton';
import WorkspaceCard from '@/components/dashboard/workspace/WorkspaceCard';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { notifyError, notifySuccess } from '@/lib/notify';
import { ETAT_LABELS, MOTIF_LABELS, type EstimationEtat, type EstimationMotif } from '@/lib/estimation/cycle';

export type EstimationResume = {
  id: string;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  motif: EstimationMotif;
  etat: EstimationEtat;
  priceValue: number | null;
  createdAt: string;
};

function formatEuro(n: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

function libelleAdresse(row: EstimationResume): string {
  return row.address?.trim() || 'Sans adresse';
}

export default function EstimationListe({
  rows,
  onOuvrir,
  onNouvelle,
  onSupprimee,
}: {
  rows: EstimationResume[] | null;
  onOuvrir: (id: string) => void;
  onNouvelle: () => void;
  onSupprimee: (id: string) => void;
}) {
  const [pending, setPending] = useState<EstimationResume | null>(null);
  const [chargement, setChargement] = useState(false);

  function demanderSuppression(row: EstimationResume) {
    setPending(row);
  }

  function fermer() {
    if (chargement) return;
    setPending(null);
  }

  async function confirmer() {
    if (!pending) return;
    setChargement(true);
    try {
      const res = await fetch(`/api/dashboard/estimation/${pending.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      onSupprimee(pending.id);
      notifySuccess('Estimation supprimée');
      setPending(null);
    } catch {
      notifyError("L'estimation n'a pas pu être supprimée");
    } finally {
      setChargement(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <WorkspaceButton type="button" onClick={onNouvelle}>
          Nouvelle estimation
        </WorkspaceButton>
      </div>
      {rows == null ? (
        <ul className="flex flex-col gap-2" aria-busy="true" aria-label="Chargement des estimations">
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="h-[4.25rem] animate-pulse rounded-clay bg-black/[0.05]" />
          ))}
        </ul>
      ) : rows.length === 0 ? (
        <WorkspaceCard>
          <p className="text-pretty text-[14px] text-text-muted">Aucune estimation.</p>
        </WorkspaceCard>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex w-full items-center gap-3 rounded-clay border border-black/[0.06] bg-surface px-4 py-3.5 shadow-clay-sm hover:bg-black/[0.02]"
            >
              <button
                type="button"
                onClick={() => onOuvrir(row.id)}
                className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[14.5px] font-semibold text-text-strong">
                    {libelleAdresse(row)}
                  </span>
                  <span className="mt-0.5 block text-[12.5px] text-text-muted">
                    {ETAT_LABELS[row.etat]} · {MOTIF_LABELS[row.motif]}
                    {row.city ? ` · ${row.city}` : ''}
                  </span>
                </span>
                {row.priceValue != null ? (
                  <span className="shrink-0 font-display text-[16px] font-bold tabular-nums text-text-strong">
                    {formatEuro(row.priceValue)}
                  </span>
                ) : null}
              </button>
              <button
                type="button"
                onClick={() => demanderSuppression(row)}
                aria-label={`Supprimer ${libelleAdresse(row)}`}
                className="flex size-9 shrink-0 items-center justify-center rounded-clay border border-black/[0.12] bg-surface text-text-muted transition-colors duration-150 ease-out hover:bg-black/[0.03] hover:text-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <Trash2 size={16} strokeWidth={2} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmModal
        open={pending !== null}
        onClose={fermer}
        onConfirm={() => void confirmer()}
        title="Supprimer cette estimation ?"
        message={`Cette action est irréversible. « ${pending ? libelleAdresse(pending) : ''} » et l’avis de valeur seront définitivement supprimés.`}
        primaryLabel="Supprimer définitivement"
        variant="danger"
        isLoading={chargement}
      />
    </div>
  );
}
