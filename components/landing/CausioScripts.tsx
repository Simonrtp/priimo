'use client';

import { useEffect } from 'react';

const WIDGET_SRC =
  'https://causio.fr/widget.js?v=dpl_FS1MZUVKmBLnUmXyv1ZXznevWt5F';

const CAUSIO_CHATBOT_ID = '8fd6794c-c92b-4c7c-8616-c42ae86b8869';

/**
 * Charge le widget Causio uniquement sur la landing (monté avec cette page).
 * `beforeInteractive` n’est pas utilisable hors du layout racine ; on enchaîne
 * nettoyage Crisp → config → script widget après hydratation.
 */
export default function CausioScripts() {
  useEffect(() => {
    try {
      const w = window as Window & {
        $crisp?: { push: (args: unknown[]) => void };
        CAUSIO_CONFIG?: { chatbotId: string; apiUrl: string };
        CRISP_WEBSITE_ID?: string;
      };
      if (w.$crisp && typeof w.$crisp.push === 'function') {
        try {
          w.$crisp.push(['do', 'chat:close']);
        } catch {
          /* ignore */
        }
        try {
          w.$crisp.push(['do', 'chat:hide']);
        } catch {
          /* ignore */
        }
      }
      try {
        delete w.CRISP_WEBSITE_ID;
        (w as Window & { $crisp?: unknown }).$crisp = [];
      } catch {
        /* ignore */
      }
      try {
        document
          .querySelectorAll('script[src*="crisp.chat"], script[src*="client.crisp"]')
          .forEach((n) => n.remove());
        document.querySelectorAll('iframe[src*="crisp"], iframe[id*="crisp"]').forEach((n) => n.remove());
        ['crisp-root', 'crisp-chatbox', 'crisp-client'].forEach((id) => {
          const el = document.getElementById(id);
          if (el) el.remove();
        });
      } catch {
        /* ignore */
      }
      try {
        const ls = window.localStorage;
        for (let i = ls.length - 1; i >= 0; i--) {
          const k = ls.key(i);
          if (k && /crisp/i.test(k)) ls.removeItem(k);
        }
        const ss = window.sessionStorage;
        for (let j = ss.length - 1; j >= 0; j--) {
          const sk = ss.key(j);
          if (sk && /crisp/i.test(sk)) ss.removeItem(sk);
        }
      } catch {
        /* ignore */
      }
    } catch {
      /* ignore */
    }

    let preconnect: HTMLLinkElement | null = null;
    if (!document.querySelector('link[data-priimo-causio-preconnect]')) {
      preconnect = document.createElement('link');
      preconnect.rel = 'preconnect';
      preconnect.href = 'https://causio.fr';
      preconnect.setAttribute('data-priimo-causio-preconnect', '');
      document.head.appendChild(preconnect);
    }

    (window as Window & { CAUSIO_CONFIG?: { chatbotId: string; apiUrl?: string } }).CAUSIO_CONFIG = {
      chatbotId: CAUSIO_CHATBOT_ID,
    };

    let script: HTMLScriptElement | null = null;
    if (!document.getElementById('causio-widget-script')) {
      script = document.createElement('script');
      script.id = 'causio-widget-script';
      script.src = WIDGET_SRC;
      script.async = true;
      document.body.appendChild(script);
    }

    return () => {
      script?.remove();
      preconnect?.remove();
    };
  }, []);

  return null;
}
