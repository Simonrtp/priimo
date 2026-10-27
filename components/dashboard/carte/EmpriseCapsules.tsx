'use client';

import { Check } from 'lucide-react';

/** Ce que montre la carte : mes secteurs, ou tout le code postal. */
export type OngletCarte = 'mes' | 'code_postal';

/** Les trois territoires qu'on peut cocher dans les filtres. */
export type ChoixEmprise = 'mes' | 'agence' | 'code_postal';

const CHOIX: readonly { id: ChoixEmprise; label: string }[] = [
  { id: 'mes', label: 'Mes secteurs' },
  { id: 'agence', label: 'Secteurs de l’agence' },
  { id: 'code_postal', label: 'Code postal' },
];

export function empriseCochee(onglet: OngletCarte, secteursAgence: boolean): ChoixEmprise {
  if (onglet === 'code_postal') return 'code_postal';
  return secteursAgence ? 'agence' : 'mes';
}

export default function EmpriseCapsules({
  value,
  onChange,
  compact = false,
}: {
  value: ChoixEmprise;
  onChange: (next: ChoixEmprise) => void;
  compact?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Territoire affiché"
      className="mb-3 flex flex-col gap-1 rounded-[18px] bg-[#E8EAED] p-1.5"
    >
      {CHOIX.map((choix) => {
        const coche = choix.id === value;
        return (
          <button
            key={choix.id}
            type="button"
            role="radio"
            aria-checked={coche}
            onClick={() => onChange(choix.id)}
            className={`flex w-full cursor-pointer items-center gap-3 rounded-[14px] px-3 text-left transition-colors duration-fluid-subtle ease-in-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1A2A56] ${
              compact ? 'min-h-[44px] py-2' : 'min-h-[40px] py-1.5'
            } ${coche ? 'bg-white shadow-clay-sm' : 'hover:bg-white/60'}`}
          >
            <span
              aria-hidden
              className={`flex size-[22px] shrink-0 items-center justify-center rounded-full border transition-colors duration-200 ease-out ${
                coche ? 'border-[#1A2A56] bg-[#1A2A56] text-white' : 'border-black/[0.18] bg-white text-transparent'
              }`}
            >
              <Check size={13} strokeWidth={3} />
            </span>
            <span
              className={`min-w-0 flex-1 text-[13.5px] font-semibold leading-tight ${
                coche ? 'text-text-strong' : 'text-text'
              } ${compact ? 'text-[14.5px]' : ''}`}
            >
              {choix.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
