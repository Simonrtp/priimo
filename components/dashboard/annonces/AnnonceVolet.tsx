'use client';

import { useEffect, useState } from 'react';
import { libelleAdresse, libellePortail } from '@/lib/annonces/presenter';
import type { Annonce } from '@/lib/annonces/types';

export default function AnnonceVolet({
  annonce,
  soeurs,
  onFermer,
}: {
  annonce: Annonce;
  soeurs: Annonce[];
  onFermer: () => void;
}) {
  const [lignes, setLignes] = useState<{ id: string; texte: string }[]>([]);
  const [raisons, setRaisons] = useState<string[]>(
    annonce.confiance === 'adresse_publiee'
      ? annonce.raisonsLocalisation.filter((r) => !/dpe/i.test(r))
      : annonce.raisonsLocalisation,
  );
  const [ouvert, setOuvert] = useState(false);
  const lieu = libelleAdresse(annonce);
  const parcelle = annonce.parcelleIds[0] ?? null;

  useEffect(() => {
    let ignore = false;
    void fetch(`/api/dashboard/annonces/${annonce.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { lignes?: { id: string; texte: string }[]; raisons?: string[] } | null) => {
        if (ignore || !json) return;
        setLignes(json.lignes ?? []);
        setRaisons(
          annonce.confiance === 'adresse_publiee'
            ? (json.raisons ?? []).filter((r) => !/dpe/i.test(r))
            : (json.raisons ?? []),
        );
      });
    return () => {
      ignore = true;
    };
  }, [annonce.id, annonce.confiance]);

  return (
    <aside className="flex h-full flex-col overflow-hidden rounded-clay border border-black/[0.06] bg-surface">
      <header className="flex items-start justify-between gap-3 px-4 py-3">
        <div>
          <p className="text-[15px] font-semibold text-text-strong">{lieu.ligne}</p>
          {lieu.probable ? <p className="text-[12px] text-text-muted">Adresse probable</p> : null}
        </div>
        <button type="button" onClick={onFermer} className="text-[13px] text-text-muted">
          Fermer
        </button>
      </header>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 pb-5">
        {annonce.typeVendeur === 'particulier' && annonce.refusDemarchage ? (
          <p className="rounded-clay bg-black/[0.04] px-3 py-2 text-[13px] text-text-strong">
            Le propriétaire refuse le démarchage commercial.
          </p>
        ) : null}
        <section>
          <h2 className="mb-2 text-[16px] font-semibold text-text-strong">Historique</h2>
          <ul className="space-y-1.5">
            {lignes.length === 0 ? <li className="text-[13px] text-text-muted">Pas encore de mouvement.</li> : null}
            {lignes.map((l) => (
              <li key={l.id} className="text-[13.5px] text-text">
                {l.texte}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <button
            type="button"
            className="text-[16px] font-semibold text-text-strong"
            onClick={() => setOuvert((v) => !v)}
            aria-expanded={ouvert}
          >
            Pourquoi cette adresse ?
          </button>
          {ouvert ? (
            <ul className="mt-2 space-y-1">
              {raisons.length === 0 ? <li className="text-[13px] text-text-muted">Pas de détail.</li> : null}
              {raisons.map((r) => (
                <li key={r} className="text-[13px] text-text">
                  {r}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
        <section className="space-y-2">
          {soeurs.map((s) => (
            <a
              key={s.id}
              href={s.url}
              target="_blank"
              rel="noreferrer"
              className="block text-[13.5px] font-medium text-text-strong underline"
            >
              Voir sur {libellePortail(s.portail)}
            </a>
          ))}
          {parcelle ? (
            <a
              href={`/dashboard/prospection?vue=carte&parcelle=${encodeURIComponent(parcelle)}`}
              className="block text-[13.5px] font-medium text-text-strong underline"
            >
              Fiche de l’immeuble
            </a>
          ) : null}
          <a href="/dashboard/estimation?id=nouvelle" className="block text-[13.5px] text-text-muted">
            Ajouter aux comparables d’une estimation
          </a>
          {parcelle ? (
            <a
              href={`/dashboard/notes?parcelle=${encodeURIComponent(parcelle)}`}
              className="block text-[13.5px] text-text-muted"
            >
              Ajouter une note
            </a>
          ) : null}
        </section>
      </div>
    </aside>
  );
}
