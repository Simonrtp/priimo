'use client';

import WorkspaceButton from '@/components/dashboard/workspace/WorkspaceButton';
import WorkspaceCard from '@/components/dashboard/workspace/WorkspaceCard';
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

export default function EstimationListe({
  rows,
  onOuvrir,
  onNouvelle,
}: {
  rows: EstimationResume[] | null;
  onOuvrir: (id: string) => void;
  onNouvelle: () => void;
}) {
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
          <p className="text-[14px] text-text-muted">Aucune estimation.</p>
        </WorkspaceCard>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => onOuvrir(row.id)}
                className="flex w-full items-start justify-between gap-3 rounded-clay border border-black/[0.06] bg-surface px-4 py-3.5 text-left shadow-clay-sm hover:bg-black/[0.02]"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[14.5px] font-semibold text-text-strong">
                    {row.address?.trim() || 'Sans adresse'}
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
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
