'use client';

import { Lock, Users } from 'lucide-react';
import { PASTILLE_TRACK, pastilleClass } from '@/components/ui/pastille-classes';

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

  return (
    <div className="flex flex-col gap-1.5">
      <div role="radiogroup" aria-label={textes.titre} className={PASTILLE_TRACK}>
        {ORDRE.map((option) => {
          const actif = option === value;
          const Icone = option === 'privee' ? Lock : Users;
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={actif}
              disabled={disabled}
              onClick={() => {
                if (!actif) onChange(option);
              }}
              className={`${pastilleClass(actif)} inline-flex min-h-9 items-center gap-1.5 disabled:cursor-not-allowed ${
                disabled && !actif ? 'opacity-50' : ''
              }`}
            >
              <Icone size={13} strokeWidth={2.2} aria-hidden />
              {textes[option].label}
            </button>
          );
        })}
      </div>
      {avecAide ? <p className="text-pretty text-[12px] text-text-muted">{aide}</p> : null}
    </div>
  );
}
