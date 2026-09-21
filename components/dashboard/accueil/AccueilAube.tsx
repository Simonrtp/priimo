'use client';

import { useLayoutEffect, useRef, type ReactNode } from 'react';

/**
 * Aligne le bas du fond pêche sur le milieu réel de la carte d’objectifs.
 * La peinture reste sur le shell ; ici on ne fait que mesurer.
 */
export default function AccueilAube({ children }: { children: ReactNode }) {
  const racine = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = racine.current;
    if (!el) return;

    const hote =
      el.closest<HTMLElement>('.dashboard-mobile') ??
      el.closest<HTMLElement>('.priimo-workspace-panel');
    if (!hote) return;

    const appliquer = () => {
      const carte = el.getBoundingClientRect();
      const cadre = hote.getBoundingClientRect();
      hote.style.setProperty(
        '--accueil-aube-h',
        `${Math.max(0, carte.top - cadre.top + carte.height / 2)}px`,
      );
    };

    appliquer();
    const ro = new ResizeObserver(appliquer);
    ro.observe(el);
    ro.observe(hote);

    const scrolls: HTMLElement[] = [];
    let p: HTMLElement | null = el.parentElement;
    while (p) {
      const oy = getComputedStyle(p).overflowY;
      if (oy === 'auto' || oy === 'scroll' || oy === 'overlay') scrolls.push(p);
      p = p.parentElement;
    }
    for (const s of scrolls) s.addEventListener('scroll', appliquer, { passive: true });
    window.addEventListener('resize', appliquer);

    return () => {
      ro.disconnect();
      for (const s of scrolls) s.removeEventListener('scroll', appliquer);
      window.removeEventListener('resize', appliquer);
      hote.style.removeProperty('--accueil-aube-h');
    };
  }, []);

  return <div ref={racine}>{children}</div>;
}
