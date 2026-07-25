'use client';

import { useState } from 'react';
import ConfirmModal from '@/components/ui/ConfirmModal';

interface LeadDeleteSectionProps {
  leadId: string;
  onDelete: (id: string) => Promise<void>;
  className?: string;
}

export default function LeadDeleteSection({ leadId, onDelete, className = '' }: LeadDeleteSectionProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleConfirm = async () => {
    setDeleting(true);
    try {
      await onDelete(leadId);
      setConfirmOpen(false);
    } catch {
      // Erreur gérée par le parent (toast)
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div className={`pt-4 text-center ${className}`}>
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          className="text-mute transition-colors hover:text-ink focus:outline-none focus-visible:underline"
          style={{ fontSize: 12 }}
        >
          Supprimer ce lead
        </button>
      </div>

      <ConfirmModal
        open={confirmOpen}
        onClose={() => !deleting && setConfirmOpen(false)}
        onConfirm={handleConfirm}
        title="Supprimer ce lead ?"
        message="Cette action est irréversible. Le lead disparaîtra définitivement de votre liste."
        primaryLabel="Supprimer"
        secondaryLabel="Annuler"
        variant="primary"
        isLoading={deleting}
      />
    </>
  );
}
