'use client';

import { Fragment, useMemo } from 'react';
import { Layer, Marker, Source } from 'react-map-gl';
import { X } from 'lucide-react';
import { isUsableCoord } from '@/lib/carte/coords';
import { LOGO_PORTAIL } from '@/lib/annonces/logos';
import { eurosCourt, libellePortail } from '@/lib/annonces/presenter';
import { retirerOuPrevenir } from '@/lib/annonces/retirer-carte';
import { useAnnoncesAjoutees } from '@/lib/annonces/useAnnoncesSecteur';
import { notifyError } from '@/lib/notify';
import type { AdressePossible, Annonce } from '@/lib/annonces/types';

/** Le numéro d'une adresse possible : le même dans le panneau et sur la carte. Plein : l'adresse choisie. */
export function NumeroPossible({ n, etat }: { n: number; etat?: 'choisie' | 'estompee' }) {
  return (
    <span
      aria-hidden
      className={`inline-flex size-[18px] shrink-0 items-center justify-center rounded-full text-[10.5px] font-bold tabular-nums ring-[1.5px] ring-[#1A2A56] transition-[background-color,color,opacity] duration-fluid-subtle ${
        etat === 'choisie' ? 'bg-[#1A2A56] text-white' : 'bg-white text-[#1A2A56]'
      } ${etat === 'estompee' ? 'opacity-45' : ''}`}
    >
      {n}
    </span>
  );
}

/**
 * Les immeubles possibles d'une annonce sans adresse sûre, numérotés sur la carte.
 * Toucher un numéro le choisit (`onChoisir`) ou ouvre l'annonce (`onClick`).
 */
export function ReperesPossibles({
  possibles,
  choisie = null,
  masquerChoisie = false,
  onClick,
  onChoisir,
}: {
  possibles: readonly AdressePossible[];
  choisie?: string | null;
  /** L'adresse choisie porte déjà le point de l'annonce : son numéro s'efface (les autres gardent le leur). */
  masquerChoisie?: boolean;
  onClick?: () => void;
  onChoisir?: (adresse: string | null) => void;
}) {
  return (
    <>
      {possibles.map((p, i) =>
        isUsableCoord(p.latitude, p.longitude) && !(masquerChoisie && choisie === p.adresse) ? (
          <Marker key={`${p.adresse}-${i}`} longitude={p.longitude} latitude={p.latitude} anchor="center" style={{ zIndex: 4 }}>
            <button
              type="button"
              title={p.raison ? `${p.adresse} : ${p.raison}` : `Adresse possible : ${p.adresse}`}
              aria-label={`Adresse possible ${i + 1} : ${p.adresse}`}
              aria-pressed={onChoisir ? choisie === p.adresse : undefined}
              onClick={(e) => {
                e.stopPropagation();
                if (onChoisir) onChoisir(choisie === p.adresse ? null : p.adresse);
                else onClick?.();
              }}
              className="rounded-full shadow-[0_2px_8px_rgba(26,42,86,0.25)] transition-transform duration-fluid-subtle hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1A2A56]"
            >
              <NumeroPossible n={i + 1} etat={choisie === p.adresse ? 'choisie' : choisie ? 'estompee' : undefined} />
            </button>
          </Marker>
        ) : null,
      )}
    </>
  );
}

export type GroupePossibles = { id: string; longitude: number; latitude: number; possibles: readonly AdressePossible[] };

/**
 * Le lien entre une annonce et ses adresses possibles : un trait pointillé de sa
 * pastille vers chacune. Collé au sol, il suit la carte au zoom.
 */
export function LiensPossibles({ sourceId, groupes }: { sourceId: string; groupes: readonly GroupePossibles[] }) {
  const data = useMemo<GeoJSON.FeatureCollection<GeoJSON.LineString>>(
    () => ({
      type: 'FeatureCollection',
      features: groupes.flatMap((g) =>
        g.possibles
          .filter((p) => isUsableCoord(p.latitude, p.longitude))
          .map((p) => ({
            type: 'Feature' as const,
            properties: { annonce: g.id },
            geometry: { type: 'LineString' as const, coordinates: [[g.longitude, g.latitude], [p.longitude, p.latitude]] },
          })),
      ),
    }),
    [groupes],
  );
  return (
    <Source id={sourceId} type="geojson" data={data}>
      <Layer
        id={`${sourceId}-ligne`}
        type="line"
        layout={{ 'line-cap': 'round' }}
        paint={{ 'line-color': '#1A2A56', 'line-opacity': 0.5, 'line-width': 1.6, 'line-dasharray': [1.5, 2] }}
      />
    </Source>
  );
}

/**
 * La pastille d'une annonce ajoutée : le logo de son portail et son prix, sur
 * fond blanc. Pointillée quand l'emplacement n'est qu'un secteur.
 */
export function PastilleAjoutee({
  portailCle,
  portail,
  prix,
  approximative = false,
  onClick,
  onRetirer,
}: {
  portailCle: string;
  portail: string;
  prix: number | null;
  approximative?: boolean;
  onClick?: () => void;
  onRetirer?: () => void;
}) {
  const logo = LOGO_PORTAIL[portailCle];
  const coque = approximative
    ? 'outline-dashed outline-1 outline-offset-2 outline-[#1A2A56]/35'
    : 'ring-1 ring-black/10';
  return (
    <span className="relative inline-flex motion-safe:animate-ficheSurgit">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClick?.();
        }}
        aria-label={`Annonce ${portail}${prix != null ? ` à ${eurosCourt(prix)}` : ''}${approximative ? ', secteur approximatif' : ''}`}
        className={`inline-flex items-center gap-1.5 rounded-full bg-white px-2 py-1 text-[11px] font-semibold leading-[16px] text-text-strong shadow-[0_4px_14px_rgba(26,42,86,0.22)] transition-transform duration-fluid-subtle hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1A2A56] ${coque}`}
      >
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="" className="h-3.5 w-auto max-w-[4.5rem] object-contain" />
        ) : (
          <span className="max-w-[4.5rem] truncate">{portail}</span>
        )}
        {prix != null ? <span className="tabular-nums">{eurosCourt(prix)}</span> : null}
      </button>
      {onRetirer ? (
        <button
          type="button"
          aria-label="Retirer de la carte"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onRetirer();
          }}
          className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-white text-text-subtle shadow-[0_1px_4px_rgba(26,42,86,0.28)] ring-1 ring-black/10 hover:text-text-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1A2A56]"
        >
          <X size={10} strokeWidth={2.6} aria-hidden />
        </button>
      ) : null}
    </span>
  );
}

/**
 * Les annonces ajoutées par l'agence : toujours affichées (couche Annonces
 * allumée ou non, secteur choisi ou non), au bureau, sur le téléphone et en
 * tournée. Retirées du marché : elles s'effacent.
 */
export default function AnnoncesAjoutees({
  onChoisir,
}: {
  /** Ouvrir le volet de l'annonce ; absent (tournée) : la pastille reste un repère. */
  onChoisir?: (annonce: Annonce, soeurs: Annonce[]) => void;
}) {
  const annonces = useAnnoncesAjoutees();
  const visibles = useMemo(() => annonces.filter((a) => a.statut !== 'retiree' && isUsableCoord(a.latitude, a.longitude)), [annonces]);
  // Sans adresse choisie, l'annonce reste reliée à ses adresses possibles.
  const groupes = useMemo<GroupePossibles[]>(
    () =>
      visibles
        .filter((a) => a.confiance === 'incertaine' && !a.adresseChoisie && a.adressesPossibles?.length)
        .map((a) => ({ id: a.id, longitude: a.longitude!, latitude: a.latitude!, possibles: a.adressesPossibles! })),
    [visibles],
  );
  return (
    <>
      <LiensPossibles sourceId="priimo-annonces-ajoutees-liens" groupes={groupes} />
      {visibles.map((a) => {
          const ouvrir = onChoisir ? () => onChoisir(a, [a]) : undefined;
          const incertaine = a.confiance === 'incertaine' && !a.adresseChoisie;
          return (
            <Fragment key={a.id}>
              {incertaine && a.adressesPossibles?.length ? (
                <ReperesPossibles possibles={a.adressesPossibles} onClick={ouvrir} />
              ) : null}
              <Marker longitude={a.longitude!} latitude={a.latitude!} anchor="center" style={{ zIndex: 5 }}>
                <PastilleAjoutee
                  portailCle={a.portail}
                  portail={libellePortail(a.portail)}
                  prix={a.prix}
                  approximative={incertaine}
                  onClick={ouvrir}
                  onRetirer={() => void retirerOuPrevenir(a.id, notifyError)}
                />
              </Marker>
            </Fragment>
          );
        })}
    </>
  );
}
