'use client';

import Modal from '@/components/ui/Modal';

type ConfirmVariant = 'danger' | 'primary';

interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  variant?: ConfirmVariant;
  isLoading?: boolean;
}

const PRIMARY_CLASS: Record<ConfirmVariant, string> = {
  danger: 'bg-red-600 text-white hover:bg-red-700',
  primary: 'bg-accent text-white hover:bg-accent-dark',
};

export default function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  message,
  primaryLabel = 'Confirmer',
  secondaryLabel = 'Annuler',
  variant = 'danger',
  isLoading = false,
}: ConfirmModalProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} description={message} maxWidth="sm">
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onClose}
          disabled={isLoading}
          className="rounded-lg px-4 py-2 font-medium text-ink transition-colors hover:bg-black/[0.04] disabled:cursor-not-allowed disabled:opacity-60"
          style={{ fontSize: 13 }}
        >
          {secondaryLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isLoading}
          className={`rounded-lg px-4 py-2 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${PRIMARY_CLASS[variant]}`}
          style={{ fontSize: 13 }}
        >
          {isLoading ? 'Chargement…' : primaryLabel}
        </button>
      </div>
    </Modal>
  );
}
