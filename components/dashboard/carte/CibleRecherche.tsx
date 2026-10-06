'use client';

import { useEffect, useRef } from 'react';
import { Marker, useMap } from 'react-map-gl';
import type { CibleCarte } from '@/lib/carte/cible';
import type { BuildingMarker } from '@/lib/carte/buildings';
import type { ParcellePickExtra } from '@/lib/carte/parcelle';
import { PARCELLES_FILL_LAYER_ID, parcelleIdOf, surfaceDepuisFeature } from './ParcellesLayer';

/** Assez près pour lire l'immeuble, assez large pour voir la rue. */
const ZOOM_CIBLE = 17.5;
/** Au-delà, un immeuble suivi n'est pas celui de l'adresse cherchée. */
const RAYON_IMMEUBLE_M = 25;
/** En dessous, le volet monte du bas de l'écran ; au-dessus, il s'ouvre à gauche. */
const LARGEUR_BUREAU_PX = 768;

function distanceM(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const rad = Math.PI / 180;
  const x = (b.longitude - a.longitude) * rad * Math.cos(((a.latitude + b.latitude) / 2) * rad);
  const y = (b.latitude - a.latitude) * rad;
  return Math.sqrt(x * x + y * y) * 6_371_000;
}

/**
 * Où poser l'adresse pour qu'elle reste visible une fois le volet ouvert :
 * dans la bande haute sur téléphone (le volet couvre le bas), à droite du
 * volet sur ordinateur.
 */
function decalageSousVolet(conteneur: HTMLElement): [number, number] {
  const { clientWidth: largeur, clientHeight: hauteur } = conteneur;
  if (largeur < LARGEUR_BUREAU_PX) return [0, -Math.round(hauteur * 0.26)];
  return [Math.round(Math.min(420, largeur * 0.4) / 2), 0];
}

async function parcelleDeLAdresse(cible: CibleCarte): Promise<{ parcelleId: string; surfaceM2: number | null } | null> {
  const params = new URLSearchParams({
    lat: cible.latitude.toFixed(6),
    lon: cible.longitude.toFixed(6),
  });
  if (cible.banId) params.set('ban', cible.banId);
  try {
    const res = await fetch(`/api/carte/parcelle-au-point?${params.toString()}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { parcelleId?: string | null; surfaceM2?: number | null };
    return data.parcelleId ? { parcelleId: data.parcelleId, surfaceM2: data.surfaceM2 ?? null } : null;
  } catch {
    return null;
  }
}

/**
 * L'adresse cherchée sur la carte, comme sur un plan : la carte y vole, un
 * repère s'y pose, et ce que Priimo sait du lieu s'ouvre — l'immeuble suivi
 * par l'agence s'il existe, sinon la fiche de la parcelle. La parcelle est
 * demandée au serveur : le plan cadastral est éteint par défaut, on ne peut
 * pas compter sur ce qui est dessiné.
 */
export default function CibleRecherche({
  cible,
  buildings,
  onSelect,
  onSelectParcelle,
}: {
  cible: CibleCarte;
  buildings: readonly BuildingMarker[];
  onSelect: (building: BuildingMarker) => void;
  onSelectParcelle?: (parcelleId: string, extra?: ParcellePickExtra) => void;
}) {
  const { current: map } = useMap();
  const traitee = useRef<string | null>(null);
  const monte = useRef(false);
  /** Une réponse arrivée après une nouvelle recherche ne rouvre pas l'ancienne adresse. */
  const derniere = useRef(cible.cle);
  // Les rappels changent à chaque rendu : on garde les derniers sans relancer le vol.
  const rappels = useRef({ buildings, onSelect, onSelectParcelle });
  useEffect(() => {
    rappels.current = { buildings, onSelect, onSelectParcelle };
  });
  useEffect(() => {
    derniere.current = cible.cle;
  }, [cible.cle]);
  useEffect(() => {
    monte.current = true;
    return () => {
      monte.current = false;
    };
  }, []);

  useEffect(() => {
    // Pas de nettoyage qui annule : en mode strict, l'effet rejoué sortirait
    // ici et la demande annulée ne serait jamais relancée.
    if (!map || traitee.current === cible.cle) return;
    traitee.current = cible.cle;
    const carte = map.getMap();
    const cle = cible.cle;
    const toujoursDemandee = () => monte.current && derniere.current === cle;

    // Repli : la parcelle dessinée sous le repère, si le plan est allumé.
    const parcelleDessinee = () => {
      if (!toujoursDemandee() || !carte.getLayer(PARCELLES_FILL_LAYER_ID)) return;
      const point = carte.project([cible.longitude, cible.latitude]);
      const [parcelle] = carte.queryRenderedFeatures(point, { layers: [PARCELLES_FILL_LAYER_ID] });
      const parcelleId = parcelleIdOf(parcelle);
      if (parcelle && parcelleId) {
        rappels.current.onSelectParcelle?.(parcelleId, { surfaceM2: surfaceDepuisFeature(parcelle) });
      }
    };

    const { buildings: suivis, onSelect: choisir, onSelectParcelle: choisirParcelle } = rappels.current;
    const immeuble =
      (cible.banId ? suivis.find((b) => b.banId === cible.banId) : undefined) ??
      suivis.find((b) => distanceM(b, cible) <= RAYON_IMMEUBLE_M);
    if (immeuble) {
      choisir(immeuble);
    } else if (choisirParcelle) {
      void parcelleDeLAdresse(cible).then((trouvee) => {
        if (!toujoursDemandee()) return;
        if (trouvee) {
          rappels.current.onSelectParcelle?.(trouvee.parcelleId, { surfaceM2: trouvee.surfaceM2 });
          return;
        }
        carte.once('idle', parcelleDessinee);
        carte.triggerRepaint();
      });
    }

    carte.flyTo({
      center: [cible.longitude, cible.latitude],
      zoom: ZOOM_CIBLE,
      offset: decalageSousVolet(carte.getContainer()),
      duration: 1100,
      essential: true,
    });
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
