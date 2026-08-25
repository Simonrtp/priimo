import type { PointerEvent, MouseEvent } from 'react';

/** Touch/pen : pointerdown. Souris et clavier : click. Pas de double feu. */
export function tapProps(onTap: () => void) {
  return {
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      if (e.pointerType === 'mouse') return;
      if (e.button !== 0) return;
      e.preventDefault();
      onTap();
    },
    onClick: (_e: MouseEvent<HTMLElement>) => {
      onTap();
    },
  };
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function vibrateBrief() {
  if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10);
}
