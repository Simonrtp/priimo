'use client';

import { X } from 'lucide-react';

interface PipelineUpdateBannerProps {
  newCount: number;
  onDismiss: () => void;
  onViewNew: () => void;
}

export default function PipelineUpdateBanner({
  newCount,
  onDismiss,
  onViewNew,
}: PipelineUpdateBannerProps) {
  const label =
    newCount === 1
      ? '1 nouveau lead'
      : `${newCount} nouveaux leads`;

  return (
    <div
      role="status"
      className="mb-4 flex items-start gap-3 rounded-xl border border-accent/20 bg-accent/[0.06] px-4 py-3"
    >
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-ink" style={{ fontSize: 13, lineHeight: 1.45 }}>
          Le pipeline a été mis à jour — {label}.
        </p>
        <p className="mt-0.5 text-mute" style={{ fontSize: 12, lineHeight: 1.45 }}>
          Les précédents sont en bas de la liste.
        </p>
        <button
          type="button"
          onClick={onViewNew}
          className="mt-2 font-medium text-accent-dark underline-offset-2 transition-colors hover:text-accent hover:underline"
          style={{ fontSize: 12 }}
        >
          Voir les nouveaux
        </button>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-mute transition-colors hover:bg-black/[0.06] hover:text-ink"
        aria-label="Fermer le bandeau"
      >
        <X size={18} strokeWidth={2} aria-hidden />
      </button>
    </div>
  );
}
