'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';

/**
 * Pendant l'entrée dans l'outil, un chiffre de l'Accueil monte de 0 à sa
 * valeur au moment où son bloc apparaît. Seulement si ce bloc est encore
 * invisible (jamais un chiffre qui retombe sous les yeux) ; sinon, et hors
 * entrée, la valeur s'affiche telle quelle et suit ses changements.
 */
export function useMonteeEntree(valeur: number, ref: RefObject<HTMLElement | null>, dureeMs = 900): number {
  const [anime, setAnime] = useState<number | null>(null);
  const cible = useRef(valeur);
  useEffect(() => {
    cible.current = valeur;
  }, [valeur]);

  useEffect(() => {
    const el = ref.current;
    if (!el || valeur <= 0 || !el.closest('[data-entree="grande"]')) return;
    const bloc = el.closest<HTMLElement>('[data-accueil] > *');
    if (!bloc || Number.parseFloat(getComputedStyle(bloc).opacity) > 0.05) return;
    // Le compte démarre quand le bloc commence à apparaître (son délai de cascade).
    const delai = Number.parseFloat(getComputedStyle(bloc).animationDelay) * (getComputedStyle(bloc).animationDelay.endsWith('ms') ? 1 : 1000) || 0;
    let raf = 0;
    const zero = requestAnimationFrame(() => setAnime(0));
    const depart = window.setTimeout(() => {
      const t0 = performance.now();
      const pas = (t: number) => {
        const p = Math.min(1, (t - t0) / dureeMs);
        if (p >= 1) {
          setAnime(null);
          return;
        }
        setAnime(Math.round(cible.current * (1 - Math.pow(1 - p, 3))));
        raf = requestAnimationFrame(pas);
      };
      raf = requestAnimationFrame(pas);
    }, delai);
    return () => {
      cancelAnimationFrame(zero);
      cancelAnimationFrame(raf);
      window.clearTimeout(depart);
      setAnime(null);
    };
    // Une seule montée, au montage du chiffre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return anime ?? valeur;
}
