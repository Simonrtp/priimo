'use client';

import { useState } from 'react';
import type { ContexteGpu } from '@/lib/geo/gpu';
import type { RisqueRecense } from '@/lib/geo/georisques';
import type { ProximiteAdresse } from '@/lib/geo/proximite';
import { lignesStatsSecteur, type SecteurStatsObserves } from '@/lib/estimation/secteur-stats';
import { DVF_HORIZON_ANS, DVF_RAYON_M } from '@/lib/estimation/sources';
import CartePosition from './CartePosition';

type Onglet = 'facade' | 'immeuble' | 'secteur' | 'urbanisme';

export type ContexteAtelier = {
  resolved: boolean;
  immeuble?: {
    resolved?: boolean;
    immeubleVentes: number;
    derniereVente: string | null;
    coproLots: number | null;
    coproPeriode: string | null;
    dpeKnown: string | null;
    comparablesAppartement?: number;
    comparablesMaison?: number;
  };
  secteur?: SecteurStatsObserves;
  urbanisme?: ContexteGpu;
  risques?: RisqueRecense[];
  proximite?: ProximiteAdresse;
  dpe?: { lettre: string | null; surfaceM2: number | null; date: string | null } | null;
  facade?: { street: string; satellite: string };
};

export default function PanneauContexteAtelier({
  contexte,
  chargement,
  onCouverture,
  couvertureActive,
  latitude,
  longitude,
  onPosition,
}: {
  contexte: ContexteAtelier | null;
  chargement?: boolean;
  onCouverture: () => void;
  couvertureActive: boolean;
  latitude: number | null;
  longitude: number | null;
  onPosition?: (lat: number, lng: number) => void;
}) {
  const [onglet, setOnglet] = useState<Onglet>('facade');
  const [vue, setVue] = useState<'street' | 'satellite'>('street');
  const hasCoords = latitude != null && longitude != null;

  if (!contexte?.resolved && !chargement && !hasCoords) {
    return <aside className="rounded-clay border border-dashed border-black/10 bg-bg-subtle p-3" aria-hidden />;
  }

  if (!contexte?.resolved && chargement && !hasCoords) {
    return (
      <aside
        className="rounded-clay border border-black/[0.06] bg-surface p-3 shadow-clay-sm"
        aria-busy="true"
        aria-label="Chargement du quartier"
      >
        <div className="mb-3 flex gap-1">
          <div className="h-7 w-16 animate-pulse rounded-full bg-black/[0.06]" />
          <div className="h-7 w-20 animate-pulse rounded-full bg-black/[0.04]" />
        </div>
        <div className="h-40 animate-pulse rounded-clay bg-black/[0.05]" />
        <div className="mt-3 h-3 w-3/4 animate-pulse rounded bg-black/[0.05]" />
      </aside>
    );
  }

  const tabs: { id: Onglet; label: string }[] = [
    { id: 'facade', label: 'Façade' },
    { id: 'immeuble', label: 'Immeuble' },
    { id: 'secteur', label: 'Secteur' },
    { id: 'urbanisme', label: 'Urbanisme' },
  ];

  return (
    <aside className="rounded-clay border border-black/[0.06] bg-surface p-3 shadow-clay-sm">
      <div className="mb-3 flex flex-wrap gap-1" role="tablist" aria-label="Contexte">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={onglet === t.id}
            onClick={() => setOnglet(t.id)}
            className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${
              onglet === t.id ? 'bg-text-strong text-white' : 'text-text-muted hover:bg-black/[0.04]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {onglet === 'facade' && contexte?.facade ? (
        <div>
          <div className="mb-2 flex gap-2">
            <button
              type="button"
              onClick={() => setVue('street')}
              className="text-[12px] font-semibold text-text-strong underline-offset-2 hover:underline"
            >
              Extérieur
            </button>
            <button
              type="button"
              onClick={() => setVue('satellite')}
              className="text-[12px] font-semibold text-text-strong underline-offset-2 hover:underline"
            >
              Satellite
            </button>
          </div>
          <div className="relative h-40 overflow-hidden rounded-clay bg-bg-subtle">
            {/* Recadrage bas : masque le filigrane Google de Street View. */}
            <img
              src={vue === 'street' ? contexte.facade.street : contexte.facade.satellite}
              alt=""
              className={`absolute inset-x-0 top-0 w-full object-cover ${
                vue === 'street' ? 'h-[calc(100%+28px)]' : 'h-full'
              }`}
            />
          </div>
          <button
            type="button"
            onClick={onCouverture}
            className="mt-2 text-[12.5px] font-medium text-text-strong underline-offset-2 hover:underline"
          >
            {couvertureActive ? 'Retirer la couverture' : 'Couverture du rapport'}
          </button>
          {hasCoords ? (
            <CartePosition
              latitude={latitude}
              longitude={longitude}
              onChoisir={onPosition}
            />
          ) : null}
        </div>
      ) : null}

      {onglet === 'facade' && !contexte?.facade && hasCoords ? (
        <CartePosition
          latitude={latitude}
          longitude={longitude}
          onChoisir={onPosition}
        />
      ) : null}

      {onglet === 'immeuble' ? (
        <div>
          <dl className="flex flex-col gap-2 text-[13.5px]">
            {contexte?.immeuble?.resolved === false ? (
              <p className="text-[13px] leading-snug text-text-muted">
                Cet immeuble n’est pas encore rattaché aux ventes DVF. Ce n’est pas un décompte
                du marché.
              </p>
            ) : contexte?.immeuble ? (
              <Ligne
                libelle="Ventes dans l’immeuble"
                valeur={compteHorizon(contexte.immeuble.immeubleVentes)}
              />
            ) : null}
            {contexte?.immeuble?.coproLots != null ? (
              <Ligne libelle="Lots" valeur={String(contexte.immeuble.coproLots)} />
            ) : null}
            {contexte?.immeuble?.coproPeriode ? (
              <Ligne libelle="Construction" valeur={contexte.immeuble.coproPeriode} />
            ) : null}
            {contexte?.immeuble?.dpeKnown ? <Ligne libelle="DPE" valeur={contexte.immeuble.dpeKnown} /> : null}
            {contexte?.dpe?.surfaceM2 != null ? (
              <Ligne libelle="Surface DPE" valeur={`${Math.round(contexte.dpe.surfaceM2)} m²`} />
            ) : null}
            {contexte?.immeuble?.comparablesAppartement != null ? (
              <Ligne
                libelle="Comparables appartements"
                valeur={compteRayon(contexte.immeuble.comparablesAppartement)}
              />
            ) : null}
            {contexte?.immeuble?.comparablesMaison != null ? (
              <Ligne
                libelle="Comparables maisons"
                valeur={compteRayon(contexte.immeuble.comparablesMaison)}
              />
            ) : null}
          </dl>
          <p className="mt-3 text-[11.5px] leading-snug text-text-muted">
            DVF · Etalab · {DVF_HORIZON_ANS} dernières années
          </p>
        </div>
      ) : null}

      {onglet === 'secteur' ? (
        <dl className="flex flex-col gap-2 text-[13.5px]">
          {contexte?.proximite?.habitants != null ? (
            <Ligne
              libelle="Habitants"
              valeur={contexte.proximite.habitants.toLocaleString('fr-FR')}
            />
          ) : null}
          {contexte?.proximite?.commerces != null ? (
            <Ligne libelle="Commerces à 400 m" valeur={String(contexte.proximite.commerces)} />
          ) : null}
          {contexte?.proximite?.transports != null ? (
            <Ligne libelle="Transports à 500 m" valeur={String(contexte.proximite.transports)} />
          ) : null}
          {contexte?.secteur
            ? lignesStatsSecteur(contexte.secteur).map((l) => (
                <Ligne key={l.libelle} libelle={l.libelle} valeur={l.valeur} />
              ))
            : null}
        </dl>
      ) : null}

      {onglet === 'urbanisme' ? (
        <div className="flex flex-col gap-2 text-[13.5px]">
          {(contexte?.urbanisme?.zones ?? []).map((z, i) => (
            <p key={i}>
              <span className="font-medium">{z.libelle ?? z.typezone ?? 'Zone'}</span>
              {z.libelleType ? ` — ${z.libelleType}` : ''}
            </p>
          ))}
          {contexte?.urbanisme?.communeUrl ? (
            <a
              href={contexte.urbanisme.communeUrl}
              target="_blank"
              rel="noreferrer"
              className="font-medium underline underline-offset-2"
            >
              Documents de la commune
            </a>
          ) : null}
          {(contexte?.risques ?? []).length > 0 ? (
            <ul className="mt-2 list-disc pl-5">
              {contexte!.risques!.map((r) => (
                <li key={r.libelle}>{r.libelle}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}

function compteHorizon(n: number): string {
  return n > 0 ? `${n} sur ${DVF_HORIZON_ANS} ans` : `Aucune sur ${DVF_HORIZON_ANS} ans`;
}

function compteRayon(n: number): string {
  return n > 0
    ? `${n} dans ${DVF_RAYON_M} m, ${DVF_HORIZON_ANS} ans`
    : `Aucune dans ${DVF_RAYON_M} m, ${DVF_HORIZON_ANS} ans`;
}

function Ligne({ libelle, valeur }: { libelle: string; valeur: string }) {
  return (
    <div>
      <dt className="text-[11.5px] font-semibold uppercase text-text-subtle">{libelle}</dt>
      <dd className="text-text-strong">{valeur}</dd>
    </div>
  );
}
