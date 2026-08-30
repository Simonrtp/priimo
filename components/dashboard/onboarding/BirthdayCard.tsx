'use client';

/** Carte discrète en tête d’Accueil — non refermable, disparaît demain. */
export default function BirthdayCard({ prenoms }: { prenoms: string[] }) {
  if (prenoms.length === 0) return null;

  const phrase =
    prenoms.length === 1
      ? `Aujourd’hui, c’est l’anniversaire de ${prenoms[0]} !`
      : prenoms.length === 2
        ? `Aujourd’hui, c’est l’anniversaire de ${prenoms[0]} et ${prenoms[1]} !`
        : `Aujourd’hui, c’est l’anniversaire de ${prenoms.slice(0, -1).join(', ')} et ${prenoms[prenoms.length - 1]} !`;

  return (
    <div className="mb-4 flex items-start gap-3 rounded-clay border border-black/[0.05] bg-white px-4 py-3 shadow-clay-sm">
      <span className="shrink-0 text-[22px] leading-none" aria-hidden>
        🎂
      </span>
      <p className="text-pretty text-[14px] leading-relaxed text-ink">
        {phrase}{' '}
        <span className="onb-emoji-wave inline-block" aria-hidden>
          🎉
        </span>
      </p>
    </div>
  );
}
