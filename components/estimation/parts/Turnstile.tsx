'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Cloudflare Turnstile, rendu sur l'étape des coordonnées uniquement.
 *
 * Sans clé publique configurée, le composant ne s'affiche pas et le serveur
 * s'en remet au seul plafonnement de débit : c'est un durcissement, pas une
 * dépendance dure.
 */

type TurnstileApi = {
  render: (
    el: HTMLElement,
    opts: {
      sitekey: string;
      callback: (token: string) => void;
      'expired-callback'?: () => void;
      'error-callback'?: () => void;
      theme?: 'light' | 'dark' | 'auto';
      action?: string;
    },
  ) => string;
  remove: (id: string) => void;
};

const SCRIPT_ID = 'cf-turnstile-script';
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

function loadScript(): Promise<TurnstileApi | null> {
  return new Promise((resolve) => {
    const w = window as Window & { turnstile?: TurnstileApi };
    if (w.turnstile) {
      resolve(w.turnstile);
      return;
    }
    const existing = document.getElementById(SCRIPT_ID);
    const onReady = () => resolve(w.turnstile ?? null);
    if (existing) {
      existing.addEventListener('load', onReady, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.addEventListener('load', onReady, { once: true });
    script.addEventListener('error', () => resolve(null), { once: true });
    document.head.appendChild(script);
  });
}

export default function Turnstile({
  siteKey,
  onToken,
}: {
  siteKey: string | null;
  onToken: (token: string | null) => void;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const [indisponible, setIndisponible] = useState(false);

  useEffect(() => {
    if (!siteKey || !holder.current) return;
    let cancelled = false;
    const node = holder.current;

    void loadScript().then((api) => {
      if (cancelled || !api) {
        if (!cancelled) setIndisponible(true);
        return;
      }
      widgetId.current = api.render(node, {
        sitekey: siteKey,
        theme: 'light',
        action: 'estimation',
        callback: (token) => onToken(token),
        'expired-callback': () => onToken(null),
        'error-callback': () => onToken(null),
      });
    });

    return () => {
      cancelled = true;
      const w = window as Window & { turnstile?: TurnstileApi };
      if (widgetId.current && w.turnstile) {
        try {
          w.turnstile.remove(widgetId.current);
        } catch {
          /* le widget a déjà disparu avec le DOM */
        }
      }
      widgetId.current = null;
    };
  }, [siteKey, onToken]);

  if (!siteKey) return null;

  return (
    <div>
      <div ref={holder} />
      {indisponible ? (
        <p className="text-[12.5px] text-neutral-500">
          Vérification anti-robot indisponible pour le moment.
        </p>
      ) : null}
    </div>
  );
}
