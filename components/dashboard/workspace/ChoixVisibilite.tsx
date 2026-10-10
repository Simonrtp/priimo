'use client';

import { Lock, Users } from 'lucide-react';

export type Visibilite = 'privee' | 'agence';

/**
 * Le même choix pour une fiche contact et pour une note : la garder pour soi
 * ou la partager avec l'agence. Une note privée échappe aussi à la direction ;
 * une fiche contact privée reste visible de la direction (le fichier de
 * l'agence). Le texte d'aide le dit à chaque fois.
 */
const TEXTES: Record<
  'contact' | 'note',
  { titre: string } & Record<Visibilite, { label: string; aide: string }>
> = {
  contact: {
    titre: 'Partage de la fiche',
    privee: { label: 'Privée', aide: 'Vous et la direction voyez cette fiche.' },
    agence: { label: 'Partagée', aide: 'Toute l’agence voit cette fiche et peut la compléter.' },
  },
  note: {
    titre: 'Partage de la note',
    privee: { label: 'Privée', aide: 'Vous seul la lisez, direction comprise.' },
    agence: { label: 'Partagée', aide: 'Toute l’agence peut la lire.' },
  },
};

const ORDRE: readonly Visibilite[] = ['privee', 'agence'];

export default function ChoixVisibilite({
  objet,
  value,
  onChange,
  disabled = false,
  aideVerrou,
  avecAide = true,
}: {
  objet: 'contact' | 'note';
  value: Visibilite;
  onChange: (next: Visibilite) => void;
  disabled?: boolean;
  /** Pourquoi le choix est figé (fiche d'un collègue). */
  aideVerrou?: string;
  avecAide?: boolean;
}) {
  const textes = TEXTES[objet];
  const aide = disabled && aideVerrou ? aideVerrou : textes[value].aide;
  const index = ORDRE.indexOf(value);

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        role="switch"
        aria-checked={value === 'agence'}
        aria-label={textes.titre}
        disabled={disabled}
        onClick={() => onChange(value === 'privee' ? 'agence' : 'privee')}
        className="inline-flex h-9 w-fit items-center rounded-full bg-bg-subtle px-3 text-[13px] font-medium text-text transition-colors hover:bg-black/[0.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="inline-grid h-5 overflow-hidden">
          <span
            className="col-start-1 row-start-1 flex min-h-0 flex-col transition-transform duration-200 ease-out motion-reduce:transition-none"
            style={{ transform: `translateY(calc(${index} * -1.25rem))` }}
          >
            {ORDRE.map((option) => {
              const Icone = option === 'privee' ? Lock : Users;
              return (
                <span
                  key={option}
                  aria-hidden={option !== value}
                  className="flex h-5 items-center gap-1.5 whitespace-nowrap"
                >
                  <Icone size={14} strokeWidth={2} aria-hidden />
                  {textes[option].label}
                </span>
              );
            })}
          </span>
        </span>
      </button>
      {avecAide ? <p className="text-pretty text-[12px] text-text-muted">{aide}</p> : null}
    </div>
  );
}
