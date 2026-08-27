import type { PointerEvent, MouseEvent } from 'react';

/** Au-delà : geste de scroll / glissé, pas un tap. */
const MOVE_PX = 10;

let lastScrollAt = 0;

/** Appelé par le garde de scroll mobile (main, listes, etc.). */
export function markTouchScroll(): void {
  lastScrollAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
}

export function wasRecentScroll(ms = 320): boolean {
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  return now - lastScrollAt < ms;
}

/**
 * Tap qui laisse le scroll gagner.
 * Touch/pen : n’active qu’au pointerup si le doigt a peu bougé.
 * Souris / clavier : click.
 * Ne jamais preventDefault au pointerdown (sinon le scroll est bloqué).
 */
export function tapProps(onTap: () => void) {
  const state = {
    id: -1,
    x: 0,
    y: 0,
    moved: false,
    armed: false,
    touchHandled: false,
  };

  return {
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      if (e.pointerType === 'mouse') return;
      state.id = e.pointerId;
      state.x = e.clientX;
      state.y = e.clientY;
      state.moved = false;
      state.armed = true;
      state.touchHandled = false;
    },
    onPointerMove: (e: PointerEvent<HTMLElement>) => {
      if (!state.armed || e.pointerId !== state.id) return;
      const dx = e.clientX - state.x;
      const dy = e.clientY - state.y;
      if (dx * dx + dy * dy > MOVE_PX * MOVE_PX) state.moved = true;
    },
    onPointerUp: (e: PointerEvent<HTMLElement>) => {
      if (!state.armed || e.pointerId !== state.id) return;
      state.armed = false;
      if (e.pointerType === 'mouse') return;
      if (state.moved || wasRecentScroll()) return;
      state.touchHandled = true;
      onTap();
    },
    onPointerCancel: (e: PointerEvent<HTMLElement>) => {
      if (e.pointerId === state.id) {
        state.armed = false;
        state.moved = true;
      }
    },
    onClick: (e: MouseEvent<HTMLElement>) => {
      if (state.touchHandled) {
        state.touchHandled = false;
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (wasRecentScroll()) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
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
