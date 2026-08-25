'use client';

import Modal from '@/components/ui/Modal';
import WorkspaceButton from '@/components/dashboard/workspace/WorkspaceButton';

export const LOST_REASONS: { value: string; label: string }[] = [
  { value: 'pas_interesse', label: 'Pas intéressé' },
  { value: 'vendeur_ailleurs', label: 'Vendeur ailleurs' },
  { value: 'deja_en_mandat', label: 'Déjà en mandat' },
  { value: 'injoignable', label: 'Injoignable' },
];

export default function LostReasonDialog({
  open,
  reason,
  onReason,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  reason: string;
  onReason: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal open={open} onClose={onCancel} title="Motif de perte" maxWidth="sm">
      <p className="text-pretty text-[13px] text-text-muted">
        Indiquez pourquoi ce lead sort du pipeline. Obligatoire avant de valider.
      </p>
      <fieldset className="mt-4 flex flex-col gap-2">
        <legend className="sr-only">Motif</legend>
        {LOST_REASONS.map((item) => (
          <label
            key={item.value}
            className="flex min-h-[40px] cursor-pointer items-center gap-2.5 rounded-xl border border-black/[0.08] bg-white px-3 py-2 text-[13.5px] text-text-strong"
          >
            <input
              type="radio"
              name="lost-reason"
              value={item.value}
              checked={reason === item.value}
              onChange={() => onReason(item.value)}
              className="accent-accent"
            />
            {item.label}
          </label>
        ))}
      </fieldset>
      <div className="mt-5 flex justify-end gap-2">
        <WorkspaceButton type="button" variant="secondary" onClick={onCancel}>
          Annuler
        </WorkspaceButton>
        <WorkspaceButton type="button" onClick={onConfirm} disabled={!reason}>
          Valider
        </WorkspaceButton>
      </div>
    </Modal>
  );
}
