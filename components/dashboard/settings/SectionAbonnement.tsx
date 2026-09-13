'use client';

import { useEffect, useState } from 'react';

type Facture = { id: string; date: string; montant: string; url: string | null; statut: string };

type Apercu = {
  statut: string;
  siegesActifs: number;
  siegesInclus: number;
  montantLibelle: string;
  prochaineEcheance: string | null;
  aUnClientStripe: boolean;
  factures: Facture[];
};

const STATUT_LIBELLE: Record<string, string> = {
  essai: 'Essai',
  actif: 'Actif',
  impaye: 'Impayé',
  resilie: 'Résilié',
  en_attente: 'En attente',
};

function dateFr(iso: string | null): string {
  if (!iso) return '—';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '—';
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(t);
}

export default function SectionAbonnement() {
  const [apercu, setApercu] = useState<Apercu | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [busy, setBusy] = useState<'checkout' | 'portail' | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/dashboard/abonnement', { cache: 'no-store' });
        const data = (await res.json()) as Apercu & { error?: string };
        if (!res.ok) {
          setErreur(data.error ?? 'Impossible de lire l’abonnement.');
          return;
        }
        setApercu(data);
      } catch {
        setErreur('Impossible de lire l’abonnement.');
      }
    })();
  }, []);

  async function ouvrir(kind: 'checkout' | 'portail') {
    setBusy(kind);
    setErreur(null);
    try {
      const res = await fetch(`/api/dashboard/abonnement/${kind === 'checkout' ? 'checkout' : 'portail'}`, {
        method: 'POST',
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setErreur(data.error ?? 'Ouverture impossible.');
        return;
      }
      window.location.assign(data.url);
    } catch {
      setErreur('Ouverture impossible.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <section>
      <h2 className="mb-4 hidden font-semibold text-ink md:block sm:mb-6" style={{ fontSize: 18 }}>
        Abonnement
      </h2>
      {erreur ? <p className="mb-3 text-[13.5px] text-red-700">{erreur}</p> : null}
      {!apercu ? (
        <p className="text-[14px] text-mute">Chargement…</p>
      ) : (
        <div className="flex w-full max-w-xl flex-col gap-5">
          <div>
            <p className="text-mute uppercase tracking-widest" style={{ fontSize: 9, letterSpacing: '0.15em' }}>
              Formule
            </p>
            <p className="mt-1 text-[15px] font-semibold text-ink">
              {STATUT_LIBELLE[apercu.statut] ?? apercu.statut}
            </p>
          </div>
          <div>
            <p className="text-mute uppercase tracking-widest" style={{ fontSize: 9, letterSpacing: '0.15em' }}>
              Sièges
            </p>
            <p className="mt-1 text-[15px] font-semibold text-ink">
              {apercu.siegesActifs} utilisés sur {apercu.siegesInclus} inclus
            </p>
          </div>
          <div>
            <p className="text-mute uppercase tracking-widest" style={{ fontSize: 9, letterSpacing: '0.15em' }}>
              Prochaine échéance
            </p>
            <p className="mt-1 text-[15px] font-semibold text-ink">{dateFr(apercu.prochaineEcheance)}</p>
          </div>
          <div>
            <p className="text-mute uppercase tracking-widest" style={{ fontSize: 9, letterSpacing: '0.15em' }}>
              Montant
            </p>
            <p className="mt-1 text-[15px] font-semibold text-ink">{apercu.montantLibelle} / mois</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {apercu.aUnClientStripe ? (
              <button
                type="button"
                onClick={() => void ouvrir('portail')}
                disabled={busy !== null}
                className="rounded-lg bg-ink px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-60"
              >
                {busy === 'portail' ? 'Ouverture…' : 'Gérer carte et factures'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void ouvrir('checkout')}
                disabled={busy !== null}
                className="rounded-lg bg-ink px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-60"
              >
                {busy === 'checkout' ? 'Ouverture…' : 'Souscrire'}
              </button>
            )}
          </div>
          {apercu.factures.length > 0 ? (
            <div>
              <p className="text-mute uppercase tracking-widest" style={{ fontSize: 9, letterSpacing: '0.15em' }}>
                Factures
              </p>
              <ul className="mt-2 divide-y divide-black/[0.06]">
                {apercu.factures.map((f) => (
                  <li key={f.id} className="flex items-center justify-between py-2 text-[13.5px]">
                    <span className="text-ink">
                      {dateFr(f.date)} · {f.montant}
                    </span>
                    {f.url ? (
                      <a href={f.url} target="_blank" rel="noreferrer" className="font-semibold underline underline-offset-2">
                        Voir
                      </a>
                    ) : (
                      <span className="text-mute">{f.statut}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
