'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { ArrowDown, ChevronDown, ExternalLink, X } from 'lucide-react';
import { markerBadgeColor } from '@/lib/carte/colors';
import { dpeFillColor, parseDpeLetter } from '@/lib/carte/dpe-public';
import {
  baisseCumulee,
  dateCourte,
  euros,
  joursEnLigne,
  libelleAdresse,
  libellePortail,
  libelleVendeur,
  prixM2,
  repereApproximatif,
} from '@/lib/annonces/presenter';
import type { Annonce } from '@/lib/annonces/types';

const TYPE_BIEN: Record<string, string> = { appartement: 'Appartement', maison: 'Maison' };

function Ligne({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-t border-black/[0.05] py-2.5 first:border-t-0">
      <dt className="shrink-0 text-[12.5px] text-text-muted">{titre}</dt>
      <dd className="min-w-0 text-right text-[13.5px] font-medium text-text-strong">{children}</dd>
    </div>
  );
}

function etageLisible(etage: string | null): string | null {
  if (etage == null || etage === '') return null;
  return etage === '0' ? 'RDC' : `${etage}e étage`;
}

const BOUTON =
  'inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold transition-colors duration-fluid-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1A2A56]';

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
  const baisse = baisseCumulee(annonce);
  const m2 = prixM2(annonce);
  const jours = joursEnLigne(annonce);
  const dpe = parseDpeLetter(annonce.dpe);
  const particulier = annonce.typeVendeur === 'particulier';
  const retiree = annonce.statut === 'retiree';
  const approx = repereApproximatif(annonce) || annonce.confiance === 'incertaine';
  const portails = soeurs.length > 0 ? soeurs : [annonce];
  const bien = [
    annonce.typeBien ? TYPE_BIEN[annonce.typeBien] ?? null : null,
    annonce.pieces != null ? `${annonce.pieces} p.` : null,
    annonce.surface != null ? `${new Intl.NumberFormat('fr-FR').format(annonce.surface)} m²` : null,
    etageLisible(annonce.etage),
  ]
    .filter(Boolean)
    .join(' · ');
  const publiee = annonce.publieeLe ?? annonce.premiereVueLe;

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
    <aside className="flex h-full min-h-0 flex-col overflow-hidden rounded-clay border border-black/[0.06] bg-surface">
      <header className="flex shrink-0 items-start justify-between gap-3 px-4 pb-3 pt-4">
        <div className="min-w-0">
          <p className={`text-[19px] font-semibold leading-snug text-text-strong ${retiree ? 'line-through decoration-1' : ''}`}>
            {annonce.prix != null ? euros(annonce.prix) : 'Prix non indiqué'}
          </p>
          {baisse != null && annonce.prixInitial != null ? (
            <p className="mt-0.5 flex items-center gap-1 text-[12.5px] text-text-muted">
              <ArrowDown size={13} strokeWidth={2.5} aria-hidden className="text-accent" />
              <span className="font-semibold text-accent-dark">−{String(baisse).replace('.', ',')} %</span>
              <span className="line-through">{euros(annonce.prixInitial)}</span>
            </p>
          ) : null}
          <p className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span
              className={`rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${
                particulier ? 'bg-blue text-white' : 'bg-black/[0.06] text-text-strong'
              }`}
            >
              {libelleVendeur(annonce)}
            </span>
            {retiree ? (
              <span className="text-[12px] text-text-muted">
                Retirée{annonce.retireeLe ? ` le ${dateCourte(annonce.retireeLe)}` : ''}
              </span>
            ) : null}
          </p>
        </div>
        <button
          type="button"
          onClick={onFermer}
          aria-label="Fermer"
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-text-subtle transition-colors duration-fluid-subtle ease-in-out hover:bg-black/[0.05] hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <X size={18} strokeWidth={2} aria-hidden />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
        {particulier && annonce.refusDemarchage ? (
          <p className="mb-3 rounded-[12px] bg-black/[0.04] px-3 py-2 text-[13px] text-text-strong">
            Le propriétaire refuse le démarchage commercial.
          </p>
        ) : null}

        <dl>
          {bien ? <Ligne titre="Bien">{bien}</Ligne> : null}
          {m2 != null ? <Ligne titre="Prix au m²">{euros(m2)}</Ligne> : null}
          {dpe ? (
            <Ligne titre="DPE">
              <span
                className="inline-flex size-6 items-center justify-center rounded-full text-[11px] font-bold leading-none"
                style={{ backgroundColor: dpeFillColor(dpe), color: markerBadgeColor(dpeFillColor(dpe)) }}
                aria-label={`Classe ${dpe}`}
              >
                {dpe}
              </span>
            </Ligne>
          ) : null}
          <Ligne titre="En ligne">
            {jours != null ? (
              <>
                {jours === 0 ? 'Depuis aujourd’hui' : `Depuis ${jours} jour${jours > 1 ? 's' : ''}`}
                {publiee ? <span className="font-normal text-text-muted"> · {dateCourte(publiee)}</span> : null}
              </>
            ) : (
              'Date inconnue'
            )}
          </Ligne>
          <Ligne titre={approx ? 'Secteur' : 'Adresse'}>
            {lieu.ligne}
            {lieu.probable ? <span className="block text-[12px] font-normal text-text-muted">Adresse probable</span> : null}
            {approx ? <span className="block text-[12px] font-normal text-text-muted">Emplacement approximatif</span> : null}
          </Ligne>
          <Ligne titre={portails.length > 1 ? 'Portails' : 'Portail'}>
            {portails.map((p) => libellePortail(p.portail)).join(', ')}
          </Ligne>
        </dl>

        <section className="mt-2 border-t border-black/[0.06] pt-4">
          <h3 className="mb-2 text-[15px] font-semibold text-text-strong">Historique</h3>
          <ul className="space-y-1.5">
            {lignes.length === 0 ? <li className="text-[13px] text-text-muted">Pas encore de mouvement.</li> : null}
            {lignes.map((l) => (
              <li key={l.id} className="text-[13.5px] text-text">
                {l.texte}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-4 border-t border-black/[0.06] pt-3">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 rounded-lg py-1 text-left text-[15px] font-semibold text-text-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1A2A56]"
            onClick={() => setOuvert((v) => !v)}
            aria-expanded={ouvert}
          >
            Pourquoi cette adresse ?
            <ChevronDown
              size={16}
              strokeWidth={2}
              aria-hidden
              className={`shrink-0 text-text-subtle transition-transform duration-fluid-subtle ${ouvert ? 'rotate-180' : ''}`}
            />
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

        <section className="mt-4 flex flex-col items-start gap-2 border-t border-black/[0.06] pt-4">
          <div className="flex flex-wrap gap-2">
            {portails.map((s) => (
              <a
                key={s.id}
                href={s.url}
                target="_blank"
                rel="noreferrer"
                className={`${BOUTON} bg-blue text-white hover:bg-blue-dark`}
              >
                Voir sur {libellePortail(s.portail)}
                <ExternalLink size={13} strokeWidth={2} aria-hidden />
              </a>
            ))}
            {parcelle ? (
              <a
                href={`/dashboard/prospection?vue=carte&parcelle=${encodeURIComponent(parcelle)}`}
                className={`${BOUTON} bg-black/[0.05] text-text-strong hover:bg-black/[0.08]`}
              >
                Fiche de l’immeuble
              </a>
            ) : null}
            {parcelle ? (
              <a
                href={`/dashboard/notes?parcelle=${encodeURIComponent(parcelle)}`}
                className={`${BOUTON} bg-black/[0.05] text-text-strong hover:bg-black/[0.08]`}
              >
                Ajouter une note
              </a>
            ) : null}
          </div>
          <a
            href="/dashboard/estimation?id=nouvelle"
            className="rounded-lg text-[13px] text-text-muted underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1A2A56]"
          >
            Ajouter aux comparables d’une estimation
          </a>
        </section>
      </div>
    </aside>
  );
}
