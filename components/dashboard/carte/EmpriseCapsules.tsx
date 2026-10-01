'use client';

import { PASTILLE_TRACK, pastilleClass } from '@/components/ui/pastille-classes';
import type { MapEmprise } from '@/lib/carte/emprise';

export default function EmpriseCapsules({
  value,
  onChange,
  hasSecteur,
}: {
  value: MapEmprise;
  onChange: (next: MapEmprise) => void;
  hasSecteur: boolean;
}) {
  return (
    <div role="group" aria-label="Emprise de la carte" className={`${PASTILLE_TRACK} mb-3 w-full`}>
      <button
        type="button"
        aria-pressed={value === 'secteur'}
        disabled={!hasSecteur}
        title={hasSecteur ? 'Mon secteur' : 'Aucun secteur attribué'}
        onClick={() => onChange('secteur')}
        className={`${pastilleClass(value === 'secteur')} min-w-0 flex-1 disabled:cursor-not-allowed disabled:opacity-45`}
      >
        Secteur
      </button>
      <button
        type="button"
        aria-pressed={value === 'code_postal'}
        title="Tout le code postal"
        onClick={() => onChange('code_postal')}
        className={`${pastilleClass(value === 'code_postal')} min-w-0 flex-1`}
      >
        Code postal
      </button>
    </div>
  );
}
