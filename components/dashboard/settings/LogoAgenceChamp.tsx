'use client';

import { useRef, useState } from 'react';
import Modal from '@/components/ui/Modal';
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
  const [apercu, setApercu] = useState(false);

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

  async function supprimer() {
    setEnCours(true);
    try {
      const res = await fetch('/api/dashboard/agence/logo', { method: 'DELETE' });
      if (!res.ok) {
        notifyError('Logo non supprimé');
        return;
      }
      onUrl(null);
      setApercu(false);
      notifySuccess('Logo supprimé');
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
          <div className="flex min-w-[11.5rem] items-center gap-3 rounded-clay border border-black/[0.08] bg-surface py-1.5 pl-1.5 pr-3">
            <button
              type="button"
              disabled={enCours}
              aria-label={url ? 'Voir le logo de l’agence' : 'Ajouter le logo de l’agence'}
              onClick={() => (url ? setApercu(true) : input.current?.click())}
              className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-black/[0.06] bg-white hover:bg-black/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50"
            >
              {url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt="" className="size-full object-contain" />
              ) : (
                <span className="px-0.5 text-center font-mono text-[8px] tracking-wider text-text-muted">LOGO</span>
              )}
            </button>
            <button
              type="button"
              disabled={enCours}
              onClick={() => input.current?.click()}
              className="min-w-0 flex-1 text-left hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50"
            >
              <span className="block text-[12px] text-text-muted">Logo de l’agence</span>
              <span className="block truncate text-[13px] text-text-strong">
                {enCours ? 'Envoi…' : url ? 'Changer' : 'Ajouter'}
              </span>
            </button>
          </div>
        ) : (
          <>
            {url ? (
              <button
                type="button"
                disabled={enCours}
                aria-label="Voir le logo de l’agence"
                onClick={() => setApercu(true)}
                className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-black/8 bg-soft-gray/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="size-full object-contain" />
              </button>
            ) : (
              <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-black/8 bg-soft-gray/40">
                <span className="px-1 text-center text-[11px] text-mute">Aucun</span>
              </div>
            )}
            <button
              type="button"
              disabled={enCours}
              className="rounded-lg border border-black/10 bg-white px-3 py-2 text-[13px] font-medium text-ink hover:bg-black/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50"
              onClick={() => input.current?.click()}
            >
              {enCours ? 'Envoi…' : url ? 'Changer le logo' : 'Ajouter un logo'}
            </button>
          </>
        )}
      </div>

      {url ? (
        <Modal open={apercu} onClose={() => setApercu(false)} title="Logo de l’agence" maxWidth="sm">
          <div className="flex flex-col items-center gap-4">
            <div className="flex w-full items-center justify-center rounded-xl border border-black/[0.06] bg-soft-gray/30 p-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="Logo de l’agence" className="max-h-56 w-auto max-w-full object-contain" />
            </div>
            <button
              type="button"
              disabled={enCours}
              onClick={() => void supprimer()}
              className="text-[12.5px] text-text-muted hover:text-text-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50"
            >
              {enCours ? 'Suppression…' : 'Supprimer'}
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
