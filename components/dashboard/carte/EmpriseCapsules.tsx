'use client';

import Pastilles, { PASTILLE_TRACK } from '@/components/ui/Pastilles';

/** Ce que montre la carte : mes secteurs, ou tout le code postal. */
export type OngletCarte = 'mes' | 'code_postal';

const ONGLETS: readonly { id: OngletCarte; label: string; title: string }[] = [
  { id: 'mes', label: 'Mes secteurs', title: 'Seulement mes secteurs' },
  { id: 'code_postal', label: 'Code postal', title: 'Tout le code postal, sans secteur' },
];

export default function EmpriseCapsules({
  value,
  onChange,
}: {
  value: OngletCarte;
  onChange: (next: OngletCarte) => void;
}) {
  return (
    <Pastilles
      role="tablist"
      label="Secteurs affichés"
      value={value}
      options={ONGLETS}
      onChange={onChange}
      className={`${PASTILLE_TRACK} mb-3 w-full`}
      buttonClassName="min-w-0 flex-1 text-balance text-center leading-tight"
    />
  );
}
