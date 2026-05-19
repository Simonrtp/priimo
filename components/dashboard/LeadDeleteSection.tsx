'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
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
      <div className={`border-t border-black/[0.06] pt-6 ${className}`}>
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-3 font-medium text-red-700 transition-colors hover:bg-red-50"
          style={{ fontSize: 13 }}
        >
          <Trash2 size={16} strokeWidth={2} aria-hidden />
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
        variant="danger"
        isLoading={deleting}
      />
    </>
  );
}
