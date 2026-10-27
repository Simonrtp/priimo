'use client';

import { X } from 'lucide-react';
import { texteNouveauxLeads } from '@/lib/lead-delivery';

interface PipelineUpdateBannerProps {
  newCount: number;
  onDismiss: () => void;
}

export default function PipelineUpdateBanner({ newCount, onDismiss }: PipelineUpdateBannerProps) {
  if (newCount <= 0) return null;

  return (
    <div
      role="status"
      className="mb-4 flex items-center gap-3 rounded-xl border border-accent/20 bg-accent/[0.06] py-3 pl-4 pr-1.5"
    >
      <p className="min-w-0 flex-1 font-semibold text-ink" style={{ fontSize: 13, lineHeight: 1.45 }}>
        {texteNouveauxLeads(newCount)}
      </p>
      <button
        type="button"
        onClick={onDismiss}
        className="flex size-11 shrink-0 items-center justify-center rounded-xl text-mute transition-colors duration-fluid-subtle ease-in-out hover:bg-black/[0.08] hover:text-ink active:bg-black/[0.12]"
        aria-label="Fermer"
      >
        <X size={20} strokeWidth={2.25} aria-hidden />
      </button>
    </div>
  );
}
