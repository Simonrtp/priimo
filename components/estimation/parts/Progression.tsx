'use client';

/**
 * Progression du parcours.
 *
 * Le rang ET le total sont écrits en toutes lettres : « Étape 3 sur 8 ».
 * Une barre seule ne dit pas combien il reste à faire.
 *
 * `tone="accent"` : couleur d’agence / widget (--est-accent).
 * `tone="neutral"` : barre sobre (dashboard Priimo — pas d’orange).
 */
export default function Progression({
  index,
  total,
  nom,
  tone = 'accent',
}: {
  /** Rang courant : 0 = début (barre vide). */
  index: number;
  total: number;
  nom: string;
  tone?: 'accent' | 'neutral';
}) {
  const safeTotal = Math.max(1, total);
  const safeIndex = Math.max(0, Math.min(index, safeTotal));
  const pct = Math.min(100, Math.round((safeIndex / safeTotal) * 100));
  const barColor = tone === 'neutral' ? '#1E3148' : 'var(--est-accent)';

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <p className="text-[13px] font-medium text-neutral-700">
          Étape {safeIndex} sur {safeTotal}
        </p>
        <p className="truncate text-[13px] text-neutral-500">{nom}</p>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-neutral-200"
        role="progressbar"
        aria-valuenow={safeIndex}
        aria-valuemin={0}
        aria-valuemax={safeTotal}
        aria-label={`Étape ${safeIndex} sur ${safeTotal} : ${nom}`}
      >
        <div
          className="h-full rounded-full transition-[width] duration-300 ease-out"
          style={{ width: `${pct}%`, backgroundColor: barColor }}
        />
      </div>
    </div>
  );
}
