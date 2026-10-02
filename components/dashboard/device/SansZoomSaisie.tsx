'use client';

import { useEffect } from 'react';

/**
 * iOS zoome dès qu'on touche un champ de moins de 16 px, et ne revient pas :
 * l'écran reste agrandi, décalé, jusqu'à ce que l'agent pince. `maximum-scale=1`
 * coupe ce zoom automatique sans retirer le pincement, qu'iOS laisse toujours
 * libre (il ignore la consigne pour le geste de l'utilisateur). Android ne zoome
 * pas sur les champs : on n'y touche pas, le pincement y reste entier.
 */
export default function SansZoomSaisie() {
  useEffect(() => {
    const ios =
      /iP(hone|ad|od)/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (!ios) return;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
    if (!meta || /maximum-scale/.test(meta.content)) return;
    const avant = meta.content;
    meta.content = `${avant}, maximum-scale=1`;
    return () => {
      meta.content = avant;
    };
  }, []);
  return null;
}
