'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import type { BuildingMarker, MapViewport } from '@/lib/carte/buildings';
import { useParcelleMap } from '@/lib/carte/use-parcelle-map';
import { ParcelleDrawer } from '@/components/dashboard/carte/ParcellePanel';
import { MAPBOX_TOKEN } from '@/lib/map/style';
import OnboardingShell from './OnboardingShell';

const SectorMapCanvas = dynamic(
  () => import('@/components/dashboard/carte/SectorMapCanvas'),
  {
    ssr: false,
    loading: () => <div className="h-full w-full animate-pulse bg-black/[0.04]" aria-hidden />,
  },
);

/**
 * Étape 3 — il ouvre un immeuble.
 *
 * La fiche affichée est la vraie : ventes, prix au m², copropriété,
 * diagnostics. L'argument qui suit est celui à dire devant une porte, et il
 * est écrit tel quel parce qu'il tient debout : ces données sont publiques.
 *
 * L'étape n'existe pas si le secteur n'a pas encore de données cadastrales —
 * le parcours la retire en amont plutôt que d'ouvrir une fiche vide.
 */
export default function EtapeImmeuble({
  rang,
  total,
  buildings,
  center,
  onSuivant,
}: {
  rang: number;
  total: number;
  buildings: readonly BuildingMarker[];
  center: { latitude: number | null; longitude: number | null };
  onSuivant: () => void;
}) {
  const [viewport, setViewport] = useState<MapViewport | null>(null);
  const parcelle = useParcelleMap(true, viewport);
  // Sans jeton carte, aucune parcelle n'est cliquable : l'étape ne doit pas
  // se refermer sur l'agent. Elle reste franchissable.
  const [ouverte, setOuverte] = useState(!MAPBOX_TOKEN);

  useEffect(() => {
    if (parcelle.fiche) setOuverte(true);
  }, [parcelle.fiche]);

  return (
    <OnboardingShell
      rang={rang}
      total={total}
      titre={ouverte ? 'Tout est public' : 'Ouvrez un immeuble'}
      phrase={
        ouverte
          ? 'Vous pouvez dire ça à voix haute devant une porte. C’est public, c’est sur le site des impôts.'
          : 'Cliquez sur une parcelle de votre secteur.'
      }
      action={
        ouverte ? (
          <button
            type="button"
            onClick={onSuivant}
            className="rounded-lg bg-[#E8743C] px-5 py-2.5 text-[14px] font-semibold text-white transition hover:brightness-[0.97]"
          >
            Continuer
          </button>
        ) : null
      }
    >
      <div className="h-full min-h-0 overflow-hidden rounded-clay border border-black/[0.06] bg-white shadow-clay-sm">
        <SectorMapCanvas
          buildings={buildings}
          center={center}
          selectedBanId={null}
          onSelect={() => undefined}
          onDeselect={() => undefined}
          onViewport={setViewport}
          parcellesEnabled
          cadastreImmeubles={parcelle.immeubles}
          cadastreLayers={{ cadastreDpe: true, cadastreVentes: true, cadastreCopro: true }}
          selectedParcelleId={parcelle.selectedParcelleId}
          onSelectParcelle={parcelle.openParcelle}
        />
      </div>

      <ParcelleDrawer
        fiche={parcelle.fiche}
        loading={parcelle.loading}
        onClose={parcelle.closeParcelle}
      />
    </OnboardingShell>
  );
}
