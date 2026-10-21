'use client';

import { Marker } from 'react-map-gl';
import { isUsableCoord } from '@/lib/carte/coords';
import { LOGO_PORTAIL } from '@/lib/annonces/logos';
import { eurosCourt, libellePortail } from '@/lib/annonces/presenter';
import { useAnnoncesAjoutees } from '@/lib/annonces/useAnnoncesSecteur';
import type { Annonce } from '@/lib/annonces/types';

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
}: {
  portailCle: string;
  portail: string;
  prix: number | null;
  approximative?: boolean;
  onClick?: () => void;
}) {
  const logo = LOGO_PORTAIL[portailCle];
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      aria-label={`Annonce ${portail}${prix != null ? ` à ${eurosCourt(prix)}` : ''}${approximative ? ', secteur approximatif' : ''}`}
      className={`relative inline-flex items-center gap-1.5 rounded-full bg-white px-2 py-1 text-[11px] font-semibold leading-[16px] text-text-strong shadow-[0_4px_14px_rgba(26,42,86,0.22)] transition-transform duration-fluid-subtle hover:scale-105 motion-safe:animate-ficheSurgit focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1A2A56] ${
        approximative ? 'outline-dashed outline-1 outline-offset-2 outline-[#1A2A56]/35' : 'ring-1 ring-black/10'
      }`}
    >
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="" className="h-3.5 w-auto max-w-[4.5rem] object-contain" />
      ) : (
        <span className="max-w-[4.5rem] truncate">{portail}</span>
      )}
      {prix != null ? <span className="tabular-nums">{eurosCourt(prix)}</span> : null}
    </button>
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
  return (
    <>
      {annonces
        .filter((a) => a.statut !== 'retiree' && isUsableCoord(a.latitude, a.longitude))
        .map((a) => (
          <Marker key={a.id} longitude={a.longitude!} latitude={a.latitude!} anchor="center" style={{ zIndex: 5 }}>
            <PastilleAjoutee
              portailCle={a.portail}
              portail={libellePortail(a.portail)}
              prix={a.prix}
              approximative={a.confiance === 'incertaine'}
              onClick={onChoisir ? () => onChoisir(a, [a]) : undefined}
            />
          </Marker>
        ))}
    </>
  );
}
