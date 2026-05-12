'use client';

import { X } from 'lucide-react';

interface PremiumEnterpriseModalProps {
  open: boolean;
  onClose: () => void;
}

export default function PremiumEnterpriseModal({ open, onClose }: PremiumEnterpriseModalProps) {
  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[60] animate-overlay-in"
        style={{ backgroundColor: 'rgba(17,24,39,0.12)' }}
        onClick={onClose}
        aria-hidden
      />
      <div
        className="fixed left-1/2 top-1/2 z-[70] w-[min(92vw,400px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-soft border border-black/8"
        role="dialog"
        aria-modal="true"
        aria-labelledby="premium-modal-title"
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <h2 id="premium-modal-title" className="text-lg font-semibold text-ink tracking-tight leading-snug">
            Prospects entreprises
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg text-mute hover:text-ink hover:bg-black/[0.05] transition-colors"
            aria-label="Fermer"
          >
            <X size={18} strokeWidth={1.8} />
          </button>
        </div>
        <p className="text-mute text-sm leading-relaxed mb-5">
          Passez en Premium pour débloquer les coordonnées dirigeants SCI/SARL et filtrer la liste des
          personnes morales.
        </p>
        <button
          type="button"
          className="btn btn-primary w-full"
          style={{ padding: '10px 18px', fontSize: 14, borderRadius: 10 }}
          onClick={onClose}
        >
          Passer en Premium
        </button>
        <p className="text-center text-mute mt-3" style={{ fontSize: 11 }}>
          Démo — aucun paiement
        </p>
      </div>
    </>
  );
}
