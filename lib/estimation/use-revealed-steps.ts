'use client';

import { useEffect, useRef, useState } from 'react';

export type RevealableStep = { id: string; label: string; detail?: string };

/**
 * Cadence d'affichage des étapes de calcul.
 *
 * Le moteur va vite : les étapes arrivent parfois en quelques dizaines de
 * millisecondes et défilent trop vite pour être lues. On ne rallonge pas le
 * calcul pour autant — on garantit seulement qu'une étape affichée le reste au
 * moins `minMs`. Le travail réel n'est pas ralenti ; seul l'affichage rattrape
 * son retard, et la liste complète reste consultable sur l'écran de résultat.
 */
export const STEP_MIN_DISPLAY_MS = 400;

export function useRevealedSteps(
  incoming: readonly RevealableStep[],
  minMs: number = STEP_MIN_DISPLAY_MS,
): RevealableStep[] {
  const [revealedCount, setRevealedCount] = useState(0);
  const lastRevealAt = useRef(0);

  useEffect(() => {
    if (incoming.length === 0) {
      setRevealedCount(0);
      lastRevealAt.current = 0;
      return;
    }
    if (revealedCount >= incoming.length) return;

    const elapsed = Date.now() - lastRevealAt.current;
    const wait = revealedCount === 0 ? 0 : Math.max(0, minMs - elapsed);

    const timer = window.setTimeout(() => {
      lastRevealAt.current = Date.now();
      setRevealedCount((n) => Math.min(n + 1, incoming.length));
    }, wait);

    return () => window.clearTimeout(timer);
  }, [incoming, incoming.length, revealedCount, minMs]);

  return incoming.slice(0, revealedCount);
}
