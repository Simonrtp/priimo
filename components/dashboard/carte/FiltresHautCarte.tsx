'use client';

import { PASTILLE_TRACK, pastilleClass } from '@/components/ui/pastille-classes';
import type { Zone } from '@/lib/zones/types';

/** Secteurs dont l'agent est le titulaire. Ceux des collègues n'apparaissent pas. */
export function secteursAMoi(zones: readonly Zone[], profileId: string): Zone[] {
  if (!profileId) return [];
  return zones.filter((z) => z.actif && z.assignedTo === profileId);
}

export function ChoixSecteurs({
  zones,
  zoneId,
  onZone,
}: {
  zones: readonly Zone[];
  zoneId: string;
  onZone: (id: string) => void;
}) {
  if (zones.length === 0) return null;
  return (
    <li>
      <div role="group" aria-label="Secteur" className={`${PASTILLE_TRACK} mb-1.5 w-full flex-wrap`}>
        {zones.map((z) => (
          <button
            key={z.id}
            type="button"
            aria-pressed={z.id === zoneId}
            onClick={() => onZone(z.id)}
            className={`${pastilleClass(z.id === zoneId)} min-w-0 max-w-full truncate`}
          >
            {z.nom}
          </button>
        ))}
      </div>
    </li>
  );
}
