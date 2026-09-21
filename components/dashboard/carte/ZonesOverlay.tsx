'use client';

import { Layer, Source } from 'react-map-gl';
import { collectionGeojsonDeZone } from '@/lib/zones/geometrie';
import { OPACITE_REMPLISSAGE_ZONE } from '@/lib/zones/palette';
import type { Zone } from '@/lib/zones/types';

/**
 * Contours dessinés par l'agent, en lecture seule — même dessin que l'atelier
 * secteurs, sans poignées. Un secteur choisi n'affiche que son contour ;
 * « tous » montre le pavage entier.
 */
export default function ZonesOverlay({
  zones,
  highlightedZoneId = null,
}: {
  zones: readonly Zone[];
  highlightedZoneId?: string | null;
}) {
  const visages = zones.flatMap((zone) => {
    if (!zone.actif) return [];
    if (highlightedZoneId && zone.id !== highlightedZoneId) return [];
    const data = collectionGeojsonDeZone(zone);
    if (data.features.length === 0) return [];
    return [{ zone, data }];
  });

  return (
    <>
      {visages.map(({ zone, data }) => {
        const courante = zone.id === highlightedZoneId;
        return (
          <Source
            key={zone.id}
            id={`prospection-zone-${zone.id}`}
            type="geojson"
            data={data}
          >
            <Layer
              id={`prospection-zone-fill-${zone.id}`}
              type="fill"
              paint={{
                'fill-color': zone.couleur,
                'fill-opacity': courante
                  ? OPACITE_REMPLISSAGE_ZONE * 2
                  : OPACITE_REMPLISSAGE_ZONE,
              }}
            />
            <Layer
              id={`prospection-zone-line-${zone.id}`}
              type="line"
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              paint={{
                'line-color': zone.couleur,
                'line-width': courante ? 2.5 : 1.5,
                'line-opacity': courante ? 1 : 0.7,
              }}
            />
          </Source>
        );
      })}
    </>
  );
}
