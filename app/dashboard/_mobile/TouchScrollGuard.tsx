'use client';

import { useEffect } from 'react';
import { markTouchScroll, wasRecentScroll } from './aujourdhui/tap';

const MOVE_PX = 10;

/**
 * Sur mobile : un doigt qui scrolle ne doit pas finir en « clic » sur un bouton
 * sous le doigt au relâchement. Marque le scroll et coupe les clicks fantômes.
 */
export default function TouchScrollGuard() {
  useEffect(() => {
    const root = document.querySelector('.dashboard-mobile');
    if (!root) return;

    let startX = 0;
    let startY = 0;
    let tracking = false;
    let origine: Element | null = null;

    const controle = (cible: EventTarget | null): Element | null =>
      cible instanceof Element
        ? cible.closest('button, a, [role="tab"], [role="radio"], [role="switch"], input, textarea, select')
        : null;

    const onScroll = () => markTouchScroll();

    const onTouchStart = (e: Event) => {
      const t = (e as TouchEvent).touches[0];
      if (!t) return;
      startX = t.clientX;
      startY = t.clientY;
      tracking = true;
      origine = controle(e.target);
    };

    const onTouchMove = (e: Event) => {
      if (!tracking) return;
      const t = (e as TouchEvent).touches[0];
      if (!t) return;
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      if (dx * dx + dy * dy > MOVE_PX * MOVE_PX) {
        markTouchScroll();
        tracking = false;
      }
    };

    const onTouchEnd = () => {
      tracking = false;
    };

    const onClickCapture = (e: Event) => {
      if (!wasRecentScroll()) {
        origine = null;
        return;
      }
      // Un doigt qui tremble de quelques pixels sur le bouton qu'il a touché
      // reste un tap. On ne coupe que le clic qui atterrit ailleurs.
      const ici = controle(e.target);
      if (ici && origine && ici === origine) {
        origine = null;
        return;
      }
      origine = null;
      e.preventDefault();
      e.stopPropagation();
    };

    root.addEventListener('scroll', onScroll, { passive: true, capture: true });
    root.addEventListener('touchstart', onTouchStart, { passive: true, capture: true });
    root.addEventListener('touchmove', onTouchMove, { passive: true, capture: true });
    root.addEventListener('touchend', onTouchEnd, { passive: true, capture: true });
    root.addEventListener('touchcancel', onTouchEnd, { passive: true, capture: true });
    root.addEventListener('click', onClickCapture, true);

    return () => {
      root.removeEventListener('scroll', onScroll, true);
      root.removeEventListener('touchstart', onTouchStart, true);
      root.removeEventListener('touchmove', onTouchMove, true);
      root.removeEventListener('touchend', onTouchEnd, true);
      root.removeEventListener('touchcancel', onTouchEnd, true);
      root.removeEventListener('click', onClickCapture, true);
    };
  }, []);

  return null;
}
