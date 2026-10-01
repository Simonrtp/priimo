'use client';

import { useMemo } from 'react';
import { Layer, Source } from 'react-map-gl';
import { collectionMasqueHorsZone } from '@/lib/zones/geometrie';
import type { Zone } from '@/lib/zones/types';

export const SECTEUR_MASQUE_LAYER_ID = 'secteur-masque-fill';

/** Atténue la carte hors du secteur, sans masquer le terrain à l’intérieur. */
export default function SecteurMasqueLayer({ zone }: { zone: Zone | null }) {
  const data = useMemo(
    () => (zone ? collectionMasqueHorsZone(zone) : { type: 'FeatureCollection' as const, features: [] }),
    [zone],
  );
  if (!zone || data.features.length === 0) return null;
  return (
    <Source id="secteur-masque" type="geojson" data={data}>
      <Layer
        id={SECTEUR_MASQUE_LAYER_ID}
        type="fill"
        paint={{
          'fill-color': '#C8C0B4',
          'fill-opacity': 0.4,
        }}
      />
    </Source>
  );
}
