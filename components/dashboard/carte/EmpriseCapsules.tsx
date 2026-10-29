'use client';

import { Check } from 'lucide-react';
import type { Zone } from '@/lib/zones/types';

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

const COULEUR_DEFAUT = '#1A2A56';
const COULEURS_AGENCE_DEFAUT = ['#6366F1', '#F97316', '#10B981'];

/** Silhouette de secteur volontairement approximative : une forme, pas un plan. */
const FORME_SECTEUR = 'M5 9 L15 3 L27 5 L39 12 L36 23 L22 27 L9 22 Z';
const FORMES_AGENCE = [
  'M3 8 L14 4 L20 14 L13 25 L4 21 Z',
  'M16 3 L30 5 L33 15 L21 16 Z',
  'M23 19 L34 17 L41 22 L36 27 L20 27 Z',
];

/** Même silhouette que les filtres carte (« Mes secteurs » / « Secteurs de l’agence »). */
export function PuceTerritoire({
  choix,
  couleurs,
  className = 'shrink-0',
}: {
  choix: ChoixEmprise;
  couleurs: readonly string[];
  className?: string;
}) {
  return (
    <svg viewBox="0 0 44 30" width="44" height="30" aria-hidden className={className}>
      {choix === 'mes' ? (
        <path
          d={FORME_SECTEUR}
          fill={couleurs[0]}
          fillOpacity={0.28}
          stroke={couleurs[0]}
          strokeWidth={2}
          strokeLinejoin="round"
        />
      ) : null}
      {choix === 'agence'
        ? FORMES_AGENCE.map((d, i) => (
            <path
              key={d}
              d={d}
              fill={couleurs[i % couleurs.length]}
              fillOpacity={0.3}
              stroke={couleurs[i % couleurs.length]}
              strokeWidth={1.8}
              strokeLinejoin="round"
            />
          ))
        : null}
      {choix === 'code_postal' ? (
        <>
          <rect
            x="3"
            y="3"
            width="38"
            height="24"
            rx="7"
            fill="#1A2A56"
            fillOpacity={0.06}
            stroke="#1A2A56"
            strokeOpacity={0.45}
            strokeWidth={1.8}
            strokeDasharray="4 3"
          />
          <path
            d="M22 8.5c-3 0-5 2.2-5 4.9 0 3.4 5 8.1 5 8.1s5-4.7 5-8.1c0-2.7-2-4.9-5-4.9Z"
            fill="#1A2A56"
            fillOpacity={0.75}
          />
          <circle cx="22" cy="13.4" r="1.8" fill="#fff" />
        </>
      ) : null}
    </svg>
  );
}

export default function EmpriseCapsules({
  value,
  onChange,
  zones = [],
  profileId = '',
  compact = false,
}: {
  value: ChoixEmprise;
  onChange: (next: ChoixEmprise) => void;
  zones?: readonly Zone[];
  profileId?: string;
  compact?: boolean;
}) {
  const miennes = zones.filter((z) => z.assignedTo != null && z.assignedTo === profileId);
  const couleurMes = miennes[0]?.couleur ?? COULEUR_DEFAUT;
  // Les collègues d'abord : c'est ce que « l'agence » ajoute à mes secteurs.
  const autres = zones.filter((z) => !miennes.includes(z)).map((z) => z.couleur);
  const couleursAgence = [...new Set([...autres, couleurMes])].slice(0, 3);
  for (const c of COULEURS_AGENCE_DEFAUT) if (couleursAgence.length < 3 && !couleursAgence.includes(c)) couleursAgence.push(c);
  const couleursDe = (id: ChoixEmprise) => (id === 'mes' ? [couleurMes] : id === 'agence' ? couleursAgence : []);
  return (
    <div
      role="radiogroup"
      aria-label="Territoire affiché"
      className="flex flex-col gap-1 rounded-[14px] bg-[#E6E8EB]/90 p-1.5"
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
            <PuceTerritoire choix={choix.id} couleurs={couleursDe(choix.id)} />
          </button>
        );
      })}
    </div>
  );
}
