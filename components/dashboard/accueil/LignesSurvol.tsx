import type { DetailSurvol } from '@/lib/activite/repartition';

/** Les lignes qui s’ouvrent au survol : un prénom, une valeur, pas toute l’agence. */
export default function LignesSurvol({ detail }: { detail: DetailSurvol }) {
  if (detail.lignes.length === 0 && !detail.suite) return null;
  return (
    <div className="mt-2 hidden flex-col gap-1 border-t border-black/[0.06] pt-2 group-hover/compteur:flex group-focus-within/compteur:flex [@media(hover:none)]:flex">
      {detail.lignes.map((ligne, index) => (
        <p key={`${ligne.prenom}-${index}`} className="flex items-baseline justify-between gap-2">
          <span className="min-w-0 truncate text-[12px] font-semibold text-text-strong">{ligne.prenom}</span>
          <span className="shrink-0 text-[11px] font-semibold tabular-nums text-text-muted">{ligne.valeur}</span>
        </p>
      ))}
      {detail.suite ? <p className="text-[11px] font-medium text-text-muted">{detail.suite}</p> : null}
    </div>
  );
}
