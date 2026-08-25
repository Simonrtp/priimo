'use client';

import { useCallback, useEffect, useState } from 'react';

export type InstallOutcome = 'accepted' | 'dismissed' | 'unavailable';

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  // `navigator.standalone` est la variante iOS, absente des types DOM.
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone;
  return window.matchMedia('(display-mode: standalone)').matches || iosStandalone === true;
}

/**
 * Pilote l'invite d'installation native.
 *
 * L'invite spontanée de Chrome est capricieuse : elle dépend d'heuristiques
 * d'engagement et n'apparaît pas systématiquement. On garde donc la main pour
 * la déclencher depuis un vrai bouton de l'interface.
 */
export function useInstallPrompt() {
  const [canPrompt, setCanPrompt] = useState(false);
  const [installed, setInstalled] = useState(false);
  /** Évite un rendu serveur/client divergent : rien ne s'affiche avant le montage. */
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
    setInstalled(isStandalone());
    setCanPrompt(Boolean(window.__priimoInstallPrompt));

    const onReady = () => setCanPrompt(true);
    const onInstalled = () => {
      setCanPrompt(false);
      setInstalled(true);
    };

    window.addEventListener('priimo:installready', onReady);
    window.addEventListener('priimo:installed', onInstalled);
    return () => {
      window.removeEventListener('priimo:installready', onReady);
      window.removeEventListener('priimo:installed', onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<InstallOutcome> => {
    const event = window.__priimoInstallPrompt;
    if (!event) return 'unavailable';

    await event.prompt();
    const { outcome } = await event.userChoice;

    // L'événement n'est consommable qu'une fois. Chromium en émettra un nouveau
    // plus tard si l'utilisateur a refusé : le listener remettra `canPrompt`.
    window.__priimoInstallPrompt = null;
    setCanPrompt(false);
    return outcome;
  }, []);

  return { ready, canPrompt, installed, promptInstall };
}
