import { ACCUEIL, FIELD } from '@/lib/today/field';

/**
 * Carte citation — un souffle, pas un compteur.
 * Le texte change chaque jour civil ; les prénoms viennent de l’agence.
 */
export default function CitationCard({
  texte,
  className = '',
}: {
  texte: string;
  className?: string;
}) {
  return (
    <section
      className={`flex min-w-0 items-center gap-2.5 rounded-clay-lg px-3.5 py-2.5 shadow-clay-sm sm:px-4 ${className}`}
      style={{ backgroundColor: ACCUEIL.creme }}
    >
      <span
        aria-hidden
        className="select-none font-display text-[26px] font-bold leading-none"
        style={{ color: FIELD.orange }}
      >
        “
      </span>
      <p className="min-w-0 text-pretty text-[13.5px] font-medium italic leading-snug text-text-strong sm:line-clamp-2">
        {texte}
      </p>
    </section>
  );
}
