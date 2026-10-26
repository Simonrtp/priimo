'use client';

import { PASTILLE_TRACK, pastilleClass } from '@/components/ui/pastille-classes';

/** Ce que montre la carte : mes secteurs, ou tout le code postal. */
export type OngletCarte = 'mes' | 'code_postal';

const ONGLETS: readonly { id: OngletCarte; label: string; titre: string }[] = [
  { id: 'mes', label: 'Mes secteurs', titre: 'Seulement mes secteurs' },
  { id: 'code_postal', label: 'Code postal', titre: 'Tout le code postal, sans secteur' },
];

export default function EmpriseCapsules({
  value,
  onChange,
}: {
  value: OngletCarte;
  onChange: (next: OngletCarte) => void;
}) {
  return (
    <div role="tablist" aria-label="Secteurs affichés" className={`${PASTILLE_TRACK} mb-3 w-full`}>
      {ONGLETS.map((o) => (
        <button
          key={o.id}
          type="button"
          role="tab"
          aria-selected={value === o.id}
          title={o.titre}
          onClick={() => onChange(o.id)}
          className={`${pastilleClass(value === o.id)} min-w-0 flex-1 text-balance text-center leading-tight`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
