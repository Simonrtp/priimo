'use client';

import { useEffect, type RefObject } from 'react';
import { listenOutsideDismiss } from '@/lib/ui/pointer-guard';

/** Ferme un menu / liste au tap extérieur sans cliquer ce qui est derrière. */
export function useOutsideDismiss(
  open: boolean,
  onClose: () => void,
  rootRef: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!open) return;
    return listenOutsideDismiss(() => rootRef.current, onClose);
  }, [open, onClose, rootRef]);
}
