'use client';

import { useEffect } from 'react';

/**
 * Enregistre le service worker après le chargement de la page.
 *
 * Rien en développement : un worker qui met en cache `/_next/static` ferait
 * mentir le rechargement à chaud et coûterait des heures de débogage.
 */
export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    let cancelled = false;

    const register = () => {
      if (cancelled) return;
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((error) => {
        console.error('[pwa] enregistrement du service worker', error);
      });
    };

    // `load` est déjà passé si l'hydratation a été lente : on ne l'attend pas indéfiniment.
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });

    return () => {
      cancelled = true;
      window.removeEventListener('load', register);
    };
  }, []);

  return null;
}
