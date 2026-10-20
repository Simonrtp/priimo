'use client';

import { useMemo } from 'react';
import { Layer, Source } from 'react-map-gl';
import { collectionMasqueHorsZones } from '@/lib/zones/geometrie';
import type { Zone } from '@/lib/zones/types';

export const SECTEUR_MASQUE_LAYER_ID = 'secteur-masque-fill';

/** Atténue la carte hors des secteurs affichés, sans masquer le terrain à l’intérieur. */
export default function SecteurMasqueLayer({ zones }: { zones: readonly Zone[] }) {
  const data = useMemo(() => collectionMasqueHorsZones(zones), [zones]);
  if (zones.length === 0 || data.features.length === 0) return null;
  return (
    <Source id="secteur-masque" type="geojson" data={data}>
      <Layer
        id={SECTEUR_MASQUE_LAYER_ID}
        type="fill"
        // Un voile : il s'assombrit avec la nuit au lieu de briller (FondPriimo).
        metadata={{ 'priimo:eteint': true }}
        paint={{
          'fill-color': '#C8C0B4',
          'fill-opacity': 0.4,
        }}
      />
    </Source>
  );
}
