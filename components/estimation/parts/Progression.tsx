'use client';

/**
 * Progression du parcours.
 *
 * Le rang ET le total sont écrits en toutes lettres : « Étape 3 sur 7 ».
 * Une barre seule ne dit pas combien il reste à faire, et un visiteur qui ne
 * sait pas combien il reste d'étapes abandonne.
 *
 * Les couleurs viennent de --est-accent : le même composant sert au widget
 * sobre aux couleurs de l'agence et au parcours Priimo.
 */
export default function Progression({
  index,
  total,
  nom,
}: {
  /** Rang de l'étape courante, à partir de 1. */
  index: number;
  total: number;
  nom: string;
}) {
  const pct = Math.min(100, Math.round((index / total) * 100));

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <p className="text-[13px] font-medium text-neutral-700">
          Étape {index} sur {total}
        </p>
        <p className="truncate text-[13px] text-neutral-500">{nom}</p>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-neutral-200"
        role="progressbar"
        aria-valuenow={index}
        aria-valuemin={1}
        aria-valuemax={total}
        aria-label={`Étape ${index} sur ${total} : ${nom}`}
      >
        <div
          className="h-full rounded-full transition-[width] duration-300 ease-out"
          style={{ width: `${pct}%`, backgroundColor: 'var(--est-accent)' }}
        />
      </div>
    </div>
  );
}
