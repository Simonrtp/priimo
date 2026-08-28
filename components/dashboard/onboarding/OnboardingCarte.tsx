'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import type { BuildingMarker, MapViewport } from '@/lib/carte/buildings';
import { useParcelleMap } from '@/lib/carte/use-parcelle-map';

const SectorMapCanvas = dynamic(
  () => import('@/components/dashboard/carte/SectorMapCanvas'),
  {
    ssr: false,
    loading: () => <div className="h-full w-full animate-pulse bg-black/[0.04]" aria-hidden />,
  },
);

/**
 * La vraie carte du secteur, dans la zone de contenu de l'Accueil.
 *
 * C'est le même canevas que l'écran Carte, avec les mêmes immeubles et les
 * mêmes couches : ce que l'agent voit ici est ce qu'il retrouvera. Aucune
 * image de démonstration.
 */
export default function OnboardingCarte({
  buildings,
  center,
  hauteur = 340,
  parcelles = false,
  onSelectParcelle,
  selectedParcelleId = null,
}: {
  buildings: readonly BuildingMarker[];
  center: { latitude: number | null; longitude: number | null };
  hauteur?: number;
  /** Couche cadastre : active seulement à l'étape immeuble. */
  parcelles?: boolean;
  onSelectParcelle?: (parcelleId: string) => void;
  selectedParcelleId?: string | null;
}) {
  const [viewport, setViewport] = useState<MapViewport | null>(null);
  const parcelle = useParcelleMap(parcelles, viewport);

  return (
    <div
      className="overflow-hidden rounded-clay border border-black/[0.06] bg-white shadow-clay-sm"
      style={{ height: hauteur }}
    >
      <SectorMapCanvas
        buildings={buildings}
        center={center}
        selectedBanId={null}
        onSelect={() => undefined}
        onDeselect={() => undefined}
        onViewport={setViewport}
        parcellesEnabled={parcelles}
        cadastreImmeubles={parcelle.immeubles}
        cadastreLayers={{ cadastreDpe: true, cadastreVentes: true, cadastreCopro: true }}
        selectedParcelleId={selectedParcelleId}
        onSelectParcelle={onSelectParcelle}
      />
    </div>
  );
}
