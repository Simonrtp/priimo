/** Persistance locale : un bandeau fermé ne revient pas via le cache RSC. */

const PREFIX = 'priimo:pipeline-banner-dismissed:';

export function isPipelineBannerDismissed(batchKey: string | null | undefined): boolean {
  if (!batchKey || typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(PREFIX + batchKey) === '1';
  } catch {
    return false;
  }
}

export function markPipelineBannerDismissed(batchKey: string | null | undefined): void {
  if (!batchKey || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PREFIX + batchKey, '1');
  } catch {
    /* quota / mode privé : le POST serveur reste la source de vérité */
  }
}
