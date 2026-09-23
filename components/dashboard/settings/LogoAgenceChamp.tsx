'use client';

import { useRef, useState } from 'react';
import { notifyError, notifySuccess } from '@/lib/notify';

export default function LogoAgenceChamp({
  url,
  onUrl,
  compact,
}: {
  url: string | null;
  onUrl: (url: string | null) => void;
  compact?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [enCours, setEnCours] = useState(false);

  async function envoyer(file: File) {
    setEnCours(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/dashboard/agence/logo', { method: 'POST', body: form });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok) {
        notifyError(data.error ?? 'Logo non enregistré');
        return;
      }
      onUrl(data.url ?? null);
      notifySuccess('Logo enregistré');
    } finally {
      setEnCours(false);
      if (input.current) input.current.value = '';
    }
  }

  async function retirer() {
    setEnCours(true);
    try {
      const res = await fetch('/api/dashboard/agence/logo', { method: 'DELETE' });
      if (!res.ok) {
        notifyError('Logo non retiré');
        return;
      }
      onUrl(null);
      notifySuccess('Logo retiré');
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className={compact ? 'min-w-0' : undefined}>
      {compact ? null : <p className="mb-1.5 text-[13px] font-medium text-gray-700">Logo de l’agence</p>}
      <div className={compact ? '' : 'flex items-center gap-3'}>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void envoyer(file);
          }}
        />
        {compact ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={enCours}
              aria-label={url ? 'Changer le logo de l’agence' : 'Ajouter le logo de l’agence'}
              onClick={() => input.current?.click()}
              className="flex min-w-[11.5rem] items-center gap-3 rounded-clay border border-black/[0.08] bg-surface py-1.5 pl-1.5 pr-3 text-left hover:bg-black/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50"
            >
              <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-black/[0.06] bg-white">
                {url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={url} alt="" className="size-full object-contain" />
                ) : (
                  <span className="px-0.5 text-center font-mono text-[8px] tracking-wider text-text-muted">LOGO</span>
                )}
              </span>
              <span className="min-w-0">
                <span className="block text-[12px] text-text-muted">Logo de l’agence</span>
                <span className="block truncate text-[13px] text-text-strong">
                  {enCours ? 'Envoi…' : url ? 'Changer' : 'Ajouter'}
                </span>
              </span>
            </button>
            {url ? (
              <button
                type="button"
                disabled={enCours}
                className="text-[12.5px] text-text-muted hover:text-text-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50"
                onClick={() => void retirer()}
              >
                Retirer
              </button>
            ) : null}
          </div>
        ) : (
          <>
            <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-black/8 bg-soft-gray/40">
              {url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt="" className="size-full object-contain" />
              ) : (
                <span className="px-1 text-center text-[11px] text-mute">Aucun</span>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={enCours}
                className="rounded-lg border border-black/10 bg-white px-3 py-2 text-[13px] font-medium text-ink hover:bg-black/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50"
                onClick={() => input.current?.click()}
              >
                {enCours ? 'Envoi…' : url ? 'Changer le logo' : 'Ajouter un logo'}
              </button>
              {url ? (
                <button
                  type="button"
                  disabled={enCours}
                  className="text-left text-[12.5px] text-mute hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50"
                  onClick={() => void retirer()}
                >
                  Retirer le logo
                </button>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
