'use client';

import { useEffect, type RefObject } from 'react';
import type { MapRef } from 'react-map-gl';

/**
 * Mapbox GL 3 ne mesure son conteneur qu'à la création de la carte et quand
 * la fenêtre change de taille. Si le parent change de dimensions ensuite
 * (marges de page retirées après coup, barre d'onglets, barre d'adresse
 * Safari), le canvas garde sa taille de départ : une bande vide apparaît à
 * droite et en bas de la carte. Ce hook recale le canvas à chaque changement.
 *
 * `pret` : vrai (ou un compteur non nul) une fois la carte chargée. Une carte
 * démontée puis remontée passe un nouveau compteur pour être réobservée.
 */
export function useCanvasAJour(mapRef: RefObject<MapRef | null>, pret: boolean | number): void {
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!pret || !map) return;
    const conteneur = map.getContainer();
    let image = 0;

    const recaler = () => {
      window.cancelAnimationFrame(image);
      image = window.requestAnimationFrame(() => {
        const canvas = map.getCanvas();
        if (
          Math.abs(canvas.clientWidth - conteneur.clientWidth) > 1 ||
          Math.abs(canvas.clientHeight - conteneur.clientHeight) > 1
        ) {
          map.resize();
        }
      });
    };

    const observateur = new ResizeObserver(recaler);
    observateur.observe(conteneur);
    // La carte a pu naître avant que la page ne prenne sa forme définitive.
    recaler();
    window.visualViewport?.addEventListener('resize', recaler);
    window.addEventListener('pageshow', recaler);

    return () => {
      observateur.disconnect();
      window.cancelAnimationFrame(image);
      window.visualViewport?.removeEventListener('resize', recaler);
      window.removeEventListener('pageshow', recaler);
    };
  }, [mapRef, pret]);
}
