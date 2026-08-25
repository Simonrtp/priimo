/**
 * `beforeinstallprompt` n'est pas dans la lib DOM standard : il n'est
 * implémenté que par les navigateurs Chromium et reste hors spécification.
 */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: readonly string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

interface WindowEventMap {
  beforeinstallprompt: BeforeInstallPromptEvent;
  appinstalled: Event;
}

interface Window {
  /**
   * L'événement capté au plus tôt par le script d'amorçage du layout racine.
   * Chromium ne le déclenche qu'une fois, souvent avant l'hydratation de React :
   * on le met de côté ici pour que le bouton d'installation le retrouve.
   */
  __priimoInstallPrompt: BeforeInstallPromptEvent | null;
}
