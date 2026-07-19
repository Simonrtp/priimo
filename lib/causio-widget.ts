/** Retire le widget Causio du DOM (navigation hors landing). */
export function removeCausioWidget(): void {
  if (typeof window === 'undefined') return;

  try {
    const w = window as Window & {
      CAUSIO?: { close?: () => void };
      CAUSIO_CONFIG?: unknown;
      __CAUSIO_WIDGET_SCRIPT_ORIGIN__?: unknown;
    };
    w.CAUSIO?.close?.();
  } catch {
    /* ignore */
  }

  [
    'causio-widget-container',
    'causio-widget-iframe',
    'causio-widget-button',
    'causio-welcome-tooltip',
    'causio-welcome-tooltip-styles',
    'causio-unread-badge',
    'causio-widget-script',
  ].forEach((id) => {
    document.getElementById(id)?.remove();
  });

  document
    .querySelectorAll('script[src*="causio.fr/widget"], script[src*="widget.app.js"]')
    .forEach((node) => node.remove());
  document.querySelector('link[data-priimo-causio-preconnect]')?.remove();

  try {
    const w = window as Window & {
      CAUSIO?: unknown;
      CAUSIO_CONFIG?: unknown;
      __CAUSIO_WIDGET_SCRIPT_ORIGIN__?: unknown;
    };
    delete w.CAUSIO;
    delete w.CAUSIO_CONFIG;
    delete w.__CAUSIO_WIDGET_SCRIPT_ORIGIN__;
  } catch {
    /* ignore */
  }
}
