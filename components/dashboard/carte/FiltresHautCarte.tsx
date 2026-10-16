'use client';

import Pastilles from '@/components/ui/Pastilles';
import { PASTILLE_TRACK, pastilleClass } from '@/components/ui/pastille-classes';
import type { MapPeriod } from '@/lib/carte/buildings';
import type { Zone } from '@/lib/zones/types';

const PERIODES: { id: string; label: string; value: MapPeriod }[] = [
  { id: '30', label: '30j', value: 30 },
  { id: '90', label: '90j', value: 90 },
  { id: '365', label: '1 an', value: 365 },
  { id: 'all', label: 'Tout', value: 'all' },
];

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

export default function FiltresHautCarte({
  period,
  onPeriod,
}: {
  period: MapPeriod;
  onPeriod: (next: MapPeriod) => void;
}) {
  return (
    <div className="mb-3 flex flex-col gap-2">
      <Pastilles
        label="Période"
        value={String(period)}
        options={PERIODES.map((p) => ({ id: p.id, label: p.label }))}
        onChange={(id) => {
          const choisi = PERIODES.find((p) => p.id === id);
          if (choisi) onPeriod(choisi.value);
        }}
      />
    </div>
  );
}
