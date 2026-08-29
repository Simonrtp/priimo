'use client';

import { useEffect, useState } from 'react';

/**
 * Ce que la base sait déjà, pendant que le visiteur répond.
 *
 * Règle : rien ne s'affiche tant qu'aucune adresse n'est résolue. Annoncer
 * « aucune vente connue » sous un champ vide est décourageant et faux. Une
 * fois l'adresse résolue, on montre ce qu'on a trouvé ; si l'immeuble est
 * muet, on dit qu'on élargit au quartier — on n'annonce pas une absence.
 */

export type ContextePanneau = {
  resolved: boolean;
  city: string | null;
  postalCode: string | null;
  immeubleVentes: number;
  derniereVente: string | null;
  coproLots: number | null;
  coproPeriode: string | null;
  dpeKnown: string | null;
  dpeRepartition: { letter: string; count: number }[];
  parcelleKnown: boolean;
  /** Compteurs préchargés une fois l’adresse résolue — pas de refetch au type. */
  comparablesAppartement?: number | null;
  comparablesMaison?: number | null;
  /** Rétrocompat / dérivé côté client. */
  comparables: number | null;
};

export type PanneauEtape = 'adresse' | 'bien' | 'dpe';

const DPE_COULEURS: Record<string, string> = {
  A: '#00A06D',
  B: '#52B153',
  C: '#A6CE39',
  D: '#F5D000',
  E: '#F0A400',
  F: '#EB6D2D',
  G: '#D8232A',
};

function Ligne({
  libelle,
  valeur,
  delai,
}: {
  libelle: string;
  valeur: React.ReactNode;
  delai: number;
}) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setVisible(true), delai);
    return () => window.clearTimeout(t);
  }, [delai]);

  return (
    <div
      className="border-b border-black/[0.06] py-3 last:border-0"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'none' : 'translateY(4px)',
        transition: 'opacity 260ms ease-out, transform 260ms ease-out',
      }}
    >
      <p className="text-[12px] uppercase tracking-wide text-neutral-500">{libelle}</p>
      <div className="mt-1 text-[14px] leading-snug text-neutral-900">{valeur}</div>
    </div>
  );
}

function moisAnnee(iso: string | null): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(t);
}

export default function PanneauContexte({
  contexte,
  etape,
  adresse,
  facadeUrl,
  propertyType = '',
}: {
  contexte: ContextePanneau | null;
  /** Jusqu'où le parcours est allé : conditionne ce qui est déjà connu. */
  etape: PanneauEtape;
  adresse: string | null;
  /** Vignette de façade, si une source d'image est disponible. */
  facadeUrl?: string | null;
  propertyType?: 'appartement' | 'maison' | '';
}) {
  // Pas de vignette de remplacement : une image absente ne laisse pas de trou.
  const [facadeEnErreur, setFacadeEnErreur] = useState(false);

  // Rien tant que l'adresse n'est pas résolue.
  if (!contexte?.resolved) return null;

  const comparables =
    propertyType === 'maison'
      ? (contexte.comparablesMaison ?? contexte.comparables)
      : propertyType === 'appartement'
        ? (contexte.comparablesAppartement ?? contexte.comparables)
        : contexte.comparables;

  const commune = [contexte.city, contexte.postalCode].filter(Boolean).join(' · ');
  const derniere = moisAnnee(contexte.derniereVente);
  const totalDpe = contexte.dpeRepartition.reduce((sum, e) => sum + e.count, 0);

  let delai = 0;
  const prochainDelai = () => {
    const d = delai;
    delai += 90;
    return d;
  };

  return (
    <aside
      aria-label="Ce que nous savons déjà de cette adresse"
      className="rounded-2xl border border-black/[0.07] bg-white p-5"
    >
      <p className="text-[12px] font-semibold uppercase tracking-wide text-neutral-500">
        Ce que nous savons déjà
      </p>

      {facadeUrl && !facadeEnErreur ? (
        <div className="relative mt-3 aspect-[3/2] w-full overflow-hidden rounded-xl bg-neutral-100">
          {/* Recadrage bas : masque le filigrane Google intégré à l’API Street View. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={facadeUrl}
            alt=""
            className="absolute inset-x-0 top-0 h-[calc(100%+32px)] w-full object-cover"
            loading="lazy"
            onError={() => setFacadeEnErreur(true)}
          />
        </div>
      ) : null}

      <div className="mt-3">
        {adresse ? <Ligne libelle="Adresse" valeur={adresse} delai={prochainDelai()} /> : null}

        {commune ? <Ligne libelle="Commune" valeur={commune} delai={prochainDelai()} /> : null}

        <Ligne
          libelle="Ventes enregistrées dans l’immeuble"
          delai={prochainDelai()}
          valeur={
            contexte.immeubleVentes > 0 ? (
              <>
                {contexte.immeubleVentes} vente{contexte.immeubleVentes > 1 ? 's' : ''}
                {derniere ? (
                  <span className="text-neutral-500"> · dernière en {derniere}</span>
                ) : null}
              </>
            ) : (
              <span className="text-neutral-600">
                Nous élargirons au quartier pour trouver des comparables.
              </span>
            )
          }
        />

        {contexte.coproLots != null || contexte.coproPeriode ? (
          <Ligne
            libelle="Copropriété"
            delai={prochainDelai()}
            valeur={
              <>
                {contexte.coproLots != null ? `${contexte.coproLots} lots` : 'Identifiée'}
                {contexte.coproPeriode ? (
                  <span className="text-neutral-500"> · {contexte.coproPeriode}</span>
                ) : null}
              </>
            }
          />
        ) : null}

        {etape !== 'adresse' && comparables != null ? (
          <Ligne
            libelle="Comparables identifiés"
            delai={prochainDelai()}
            valeur={
              comparables > 0 ? (
                <>
                  {comparables} vente{comparables > 1 ? 's' : ''} du même type
                  <span className="text-neutral-500"> dans un rayon de 200 m</span>
                </>
              ) : (
                <span className="text-neutral-600">
                  Recherche en cours d’élargissement au quartier.
                </span>
              )
            }
          />
        ) : null}

        {etape === 'dpe' && totalDpe > 0 ? (
          <Ligne
            libelle="Diagnostics énergétiques de l’immeuble"
            delai={prochainDelai()}
            valeur={
              <div className="flex flex-wrap items-center gap-1.5">
                {contexte.dpeRepartition.map((entry) => (
                  <span
                    key={entry.letter}
                    className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[12px] font-semibold text-white"
                    style={{ backgroundColor: DPE_COULEURS[entry.letter] ?? '#6B7280' }}
                    title={`${entry.count} logement${entry.count > 1 ? 's' : ''} classé${entry.count > 1 ? 's' : ''} ${entry.letter}`}
                  >
                    {entry.letter}
                    <span className="font-normal opacity-90">×{entry.count}</span>
                  </span>
                ))}
              </div>
            }
          />
        ) : null}
      </div>
    </aside>
  );
}
