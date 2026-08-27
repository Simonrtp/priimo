'use client';

import { useEffect, useRef, useState } from 'react';
import { armPointerShield } from '@/lib/ui/pointer-guard';

const SNAPS = [0.25, 0.55, 0.9] as const;

export default function MobileSheet({
  open,
  onClose,
  title,
  children,
  footer,
  initialSnap = 1,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  initialSnap?: 0 | 1 | 2;
}) {
  const [snap, setSnap] = useState(initialSnap);
  const startY = useRef(0);
  const startSnap = useRef(initialSnap);

  useEffect(() => {
    if (open) setSnap(initialSnap);
  }, [open, initialSnap]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  /**
   * La feuille mesure exactement sa hauteur d'accroche : sinon le contenu
   * défilant déborde sous l'écran et les dernières lignes sont inatteignables.
   */
  const heightPct = SNAPS[snap] * 100;

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label={title}>
      <button
        type="button"
        className="absolute inset-0 bg-[rgba(21,32,47,0.28)]"
        aria-label="Fermer"
        onPointerDown={(e) => {
          e.preventDefault();
          armPointerShield();
          onClose();
        }}
      />
      <div
        className="animate-app-sheet absolute inset-x-0 bottom-0 flex flex-col overflow-hidden rounded-t-2xl bg-surface shadow-clay-lg"
        style={{
          height: `${heightPct}dvh`,
          maxHeight: '92dvh',
          paddingBottom: 'var(--field-nav-height)',
          transition: 'height 200ms cubic-bezier(0.32, 0.72, 0, 1)',
        }}
      >
        <div
          className="flex flex-shrink-0 flex-col items-center pt-2"
          onPointerDown={(e) => {
            startY.current = e.clientY;
            startSnap.current = snap;
            (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
          }}
          onPointerUp={(e) => {
            const dy = e.clientY - startY.current;
            if (dy > 64 && snap === 0) {
              armPointerShield();
              onClose();
              return;
            }
            if (dy > 48) setSnap((s) => (s > 0 ? ((s - 1) as 0 | 1 | 2) : s));
            else if (dy < -48) setSnap((s) => (s < 2 ? ((s + 1) as 0 | 1 | 2) : s));
          }}
        >
          <div className="h-1.5 w-10 rounded-full bg-black/20" aria-hidden />
          <h2 className="w-full truncate px-5 pb-2 pt-3 text-balance font-semibold text-text-strong" style={{ fontSize: 16 }}>
            {title}
          </h2>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4">{children}</div>
        {footer ? (
          <div className="flex-shrink-0 border-t border-black/[0.06] bg-surface px-4 py-3">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
