'use client';

import { CRITERE_NOTE_LABELS, CRITERE_NOTES, type CritereNote } from '@/lib/estimation/grille';

export default function CurseurCritere({
  id,
  libelle,
  valeur,
  onChange,
}: {
  id: string;
  libelle: string;
  valeur: CritereNote | null;
  onChange: (note: CritereNote | null) => void;
}) {
  const renseigne = valeur != null;
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <p className="text-[13.5px] font-medium text-text-strong">{libelle}</p>
        <p className="text-[12px] text-text-muted">
          {renseigne ? CRITERE_NOTE_LABELS[valeur] : 'Non renseigné'}
        </p>
      </div>
      <div
        id={id}
        role="radiogroup"
        aria-label={`${libelle} — 1 Mauvais, 2 Médiocre, 3 Moyen, 4 Bon, 5 Très bon`}
        className={`flex items-center gap-1 rounded-full px-1.5 py-1 ${
          renseigne ? 'bg-bg-subtle' : 'border border-dashed border-black/15 bg-transparent'
        }`}
      >
        {CRITERE_NOTES.map((n) => {
          const actif = valeur === n;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={actif}
              onClick={() => onChange(actif ? null : n)}
              title={CRITERE_NOTE_LABELS[n]}
              className={`size-7 rounded-full text-[11px] font-semibold tabular-nums transition-colors ${
                actif
                  ? 'bg-text-strong text-white'
                  : 'text-text-subtle hover:bg-black/[0.05]'
              }`}
            >
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );
}
