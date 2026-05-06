"use client";

import { useEffect, useRef } from "react";
import { useBetaModal } from "./BetaModalContext";
import BetaForm from "./BetaForm";

// === BETA MODAL ===
// Centred dialog opened by every CTA except the inline hero form.
export default function BetaModal() {
  const { isOpen, close } = useBetaModal();
  const panelRef = useRef<HTMLDivElement>(null);

  // Focus the first input when opened (a11y)
  useEffect(() => {
    if (isOpen && panelRef.current) {
      const firstInput = panelRef.current.querySelector<HTMLInputElement>("input, select");
      firstInput?.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="beta-modal-title"
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      {/* Backdrop */}
      <div
        className="modal-backdrop absolute inset-0 bg-ink/60 backdrop-blur-sm"
        onClick={close}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className="modal-panel relative z-10 w-full sm:max-w-md mx-0 sm:mx-4 mb-0 sm:mb-0 max-h-[92dvh] sm:max-h-[85vh] overflow-y-auto overscroll-contain rounded-t-3xl sm:rounded-3xl bg-canvas p-5 sm:p-8 shadow-2xl"
      >
        <button
          type="button"
          onClick={close}
          aria-label="Fermer"
          className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full text-mute hover:bg-soft-gray hover:text-ink transition"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <h2 id="beta-modal-title" className="font-display text-2xl sm:text-3xl text-ink leading-tight">
          Rejoignez la bêta privée.
        </h2>

        <div className="mt-5">
          <BetaForm
            id="modal-form"
            showMicrocopy={false}
            onSuccess={() => {
              /* keep modal open to display the inline success state */
            }}
          />
        </div>
      </div>
    </div>
  );
}
