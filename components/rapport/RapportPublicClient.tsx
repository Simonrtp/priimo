'use client';

import { useEffect, useState } from 'react';

type Payload = {
  version: number;
  bienLabel: string | null;
  agenceNom: string;
  agentNom: string | null;
  envoyeAt: string;
  error?: string;
};

function formatDateHeure(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

export default function RapportPublicClient({ token }: { token: string }) {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    let actif = true;
    void fetch(`/api/rapport/${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = (await res.json()) as Payload;
        if (!actif) return;
        if (!res.ok) {
          setErreur(data.error ?? 'Lien introuvable');
          return;
        }
        setPayload(data);
      })
      .catch(() => {
        if (actif) setErreur('Lien introuvable');
      });
    return () => {
      actif = false;
    };
  }, [token]);

  const pdfHref = `/api/rapport/${encodeURIComponent(token)}/pdf`;

  if (erreur) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-5 py-12">
        <h1 className="text-[22px] font-semibold tracking-tight text-ink">Avis de valeur</h1>
        <p className="mt-3 text-pretty text-[15px] text-mute">{erreur}</p>
      </main>
    );
  }

  if (!payload) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="h-8 w-48 animate-pulse rounded-clay bg-black/[0.06]" aria-hidden />
        <div className="mt-6 aspect-[297/210] animate-pulse rounded-clay bg-black/[0.06]" aria-hidden />
      </main>
    );
  }

  const expediteur = [payload.agentNom, payload.agenceNom].filter(Boolean).join(' · ');

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:py-10">
      <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-ink">Avis de valeur</h1>
          <p className="mt-1 text-pretty text-[14px] text-mute">
            {payload.bienLabel ? `${payload.bienLabel} · ` : ''}
            Version {payload.version}
            {expediteur ? ` · ${expediteur}` : ''}
            {' · '}
            Envoyé le {formatDateHeure(payload.envoyeAt)}
          </p>
        </div>
        <a
          href={pdfHref}
          download
          className="inline-flex min-h-[40px] items-center justify-center rounded-clay bg-[#E8743C] px-4 py-2.5 text-[14px] font-semibold text-white hover:bg-[#d46630] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E8743C]"
        >
          Télécharger le PDF
        </a>
      </header>
      <div className="overflow-hidden rounded-clay border border-black/[0.08] bg-white shadow-clay-sm">
        <iframe title="Avis de valeur" src={pdfHref} className="aspect-[297/210] w-full border-0 bg-white" />
      </div>
    </main>
  );
}
