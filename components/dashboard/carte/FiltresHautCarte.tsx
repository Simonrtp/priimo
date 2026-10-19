'use client';

import { PASTILLE_TRACK, pastilleClass } from '@/components/ui/pastille-classes';
import { ZONE_TOUS_SECTEURS } from '@/lib/carte/emprise';
import type { Zone } from '@/lib/zones/types';

export function ChoixSecteurs({
  zones,
  zoneId,
  onZone,
  tous = false,
}: {
  zones: readonly Zone[];
  zoneId: string;
  onZone: (id: string) => void;
  /** Le directeur peut afficher tous les secteurs en même temps. */
  tous?: boolean;
}) {
  if (zones.length === 0) return null;
  const montrerTous = tous && zones.length > 1;
  return (
    <li>
      <div role="group" aria-label="Secteur" className={`${PASTILLE_TRACK} mb-1.5 w-full flex-wrap`}>
        {montrerTous ? (
          <button
            type="button"
            aria-pressed={zoneId === ZONE_TOUS_SECTEURS}
            onClick={() => onZone(ZONE_TOUS_SECTEURS)}
            className={`${pastilleClass(zoneId === ZONE_TOUS_SECTEURS)} min-w-0`}
          >
            Tous
          </button>
        ) : null}
        {zones.map((z) => (
          <button
            key={z.id}
            type="button"
            aria-pressed={z.id === zoneId}
            onClick={() => onZone(z.id)}
            className={`${pastilleClass(z.id === zoneId)} inline-flex min-w-0 max-w-full items-center`}
          >
            <span aria-hidden className="mr-1.5 size-2 shrink-0 rounded-full" style={{ background: z.couleur }} />
            <span className="truncate">{z.nom}</span>
          </button>
        ))}
      </div>
    </li>
  );
}
