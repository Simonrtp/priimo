'use client';

import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { armPointerShield } from '@/lib/ui/pointer-guard';

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function PanneauLateral({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  function requestClose() {
    armPointerShield();
    onClose();
  }

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const expanded = panelRef.current?.querySelector('[aria-expanded="true"]');
        if (expanded) return;
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        armPointerShield();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const nodes = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => !el.hasAttribute('disabled') && el.tabIndex !== -1,
      );
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusable = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE);
    focusable?.focus();
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = prevOverflow;
      previousFocusRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  const node = (
    <div className="fixed inset-0 z-[130] flex justify-end" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Fermer"
        onPointerDown={(e) => {
          e.preventDefault();
          requestClose();
        }}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className="relative z-[1] flex h-dvh w-full max-w-xl flex-col overflow-hidden bg-white shadow-xl md:max-w-2xl"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex flex-shrink-0 items-start justify-between gap-4 px-5 pt-5">
          <div className="min-w-0">
            <h2
              id={titleId}
              className="text-balance text-[16px] font-semibold text-ink sm:text-[17px]"
            >
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="mt-1 text-pretty text-[13px] text-mute">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={requestClose}
            className="flex size-11 flex-shrink-0 items-center justify-center rounded-lg text-mute transition-colors hover:bg-black/[0.04] hover:text-ink"
            aria-label="Fermer"
          >
            <X size={18} strokeWidth={2} aria-hidden />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-4">{children}</div>
      </div>
    </div>
  );

  return createPortal(node, document.body);
}
