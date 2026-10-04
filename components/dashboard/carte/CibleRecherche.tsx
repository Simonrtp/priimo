'use client';

import { useEffect, useRef } from 'react';
import { Marker, useMap } from 'react-map-gl';
import type { CibleCarte } from '@/lib/carte/cible';
import type { BuildingMarker } from '@/lib/carte/buildings';
import type { ParcellePickExtra } from '@/lib/carte/parcelle';
import { cadastreDansEmprise } from '@/lib/carte/emprise';
import type { Zone } from '@/lib/zones/types';
import { PARCELLES_FILL_LAYER_ID, parcelleIdOf, surfaceDepuisFeature } from './ParcellesLayer';

/** Assez près pour lire l'immeuble, assez large pour voir la rue. */
const ZOOM_CIBLE = 17.5;
/** Au-delà, un immeuble suivi n'est pas celui de l'adresse cherchée. */
const RAYON_IMMEUBLE_M = 25;

function distanceM(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const rad = Math.PI / 180;
  const x = (b.longitude - a.longitude) * rad * Math.cos(((a.latitude + b.latitude) / 2) * rad);
  const y = (b.latitude - a.latitude) * rad;
  return Math.sqrt(x * x + y * y) * 6_371_000;
}

/**
 * L'adresse cherchée sur la carte, comme sur un plan : la carte y vole, un
 * repère s'y pose, et ce que Priimo sait du lieu s'ouvre — l'immeuble suivi
 * par l'agence s'il existe, sinon la fiche de la parcelle.
 */
export default function CibleRecherche({
  cible,
  buildings,
  clipZone = null,
  onSelect,
  onSelectParcelle,
}: {
  cible: CibleCarte;
  buildings: readonly BuildingMarker[];
  clipZone?: Zone | null;
  onSelect: (building: BuildingMarker) => void;
  onSelectParcelle?: (parcelleId: string, extra?: ParcellePickExtra) => void;
}) {
  const { current: map } = useMap();
  const traitee = useRef<string | null>(null);
  // Les rappels changent à chaque rendu : on garde les derniers sans relancer le vol.
  const rappels = useRef({ buildings, clipZone, onSelect, onSelectParcelle });
  useEffect(() => {
    rappels.current = { buildings, clipZone, onSelect, onSelectParcelle };
  });

  useEffect(() => {
    if (!map || traitee.current === cible.cle) return;
    traitee.current = cible.cle;
    const carte = map.getMap();

    const ouvrir = () => {
      const { buildings: suivis, clipZone: zone, onSelect: choisir, onSelectParcelle: choisirParcelle } =
        rappels.current;
      const immeuble =
        (cible.banId ? suivis.find((b) => b.banId === cible.banId) : undefined) ??
        suivis.find((b) => distanceM(b, cible) <= RAYON_IMMEUBLE_M);
      if (immeuble) {
        choisir(immeuble);
        return;
      }
      if (!choisirParcelle || !carte.getLayer(PARCELLES_FILL_LAYER_ID)) return;
      if (!cadastreDansEmprise(cible, zone)) return;
      const point = carte.project([cible.longitude, cible.latitude]);
      const [parcelle] = carte.queryRenderedFeatures(point, { layers: [PARCELLES_FILL_LAYER_ID] });
      const parcelleId = parcelleIdOf(parcelle);
      if (parcelle && parcelleId) choisirParcelle(parcelleId, { surfaceM2: surfaceDepuisFeature(parcelle) });
    };

    // La fiche s'ouvre une fois la carte posée : les parcelles du lieu sont alors dessinées.
    carte.once('idle', ouvrir);
    carte.flyTo({ center: [cible.longitude, cible.latitude], zoom: ZOOM_CIBLE, duration: 1100, essential: true });
    return () => {
      carte.off('idle', ouvrir);
    };
  }, [map, cible]);

  return (
    <Marker longitude={cible.longitude} latitude={cible.latitude} anchor="bottom" style={{ zIndex: 5 }}>
      <div className="pointer-events-none flex flex-col items-center" aria-label={`Adresse cherchée : ${cible.libelle}`}>
        <span className="max-w-[220px] truncate rounded-full bg-[#1a2a56] px-3 py-1.5 text-[12.5px] font-semibold text-white shadow-clay">
          {cible.libelle}
        </span>
        <span className="-mt-px h-2 w-0.5 bg-[#1a2a56]" aria-hidden />
        <span className="size-3.5 rounded-full border-[3px] border-white bg-[#1a2a56] shadow-clay-sm" aria-hidden />
      </div>
    </Marker>
  );
}
