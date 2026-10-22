import { niveauSurete, SURETE } from '@/lib/annonces/surete';
import type { Confiance } from '@/lib/annonces/types';

/** L'indice de sûreté de l'adresse : une pastille douce, un mot, l'explication au survol. */
export default function IndiceSurete({
  confiance,
  nbPossibles = 0,
  className = '',
}: {
  confiance: Confiance;
  nbPossibles?: number;
  className?: string;
}) {
  const s = SURETE[niveauSurete(confiance, nbPossibles)];
  return (
    <span
      title={`${s.titre} — ${s.aide}`}
      aria-label={`${s.titre}. ${s.aide}`}
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${className}`}
      style={{ backgroundColor: s.fond, color: s.texte }}
    >
      <span aria-hidden className="size-1.5 rounded-full" style={{ backgroundColor: s.point }} />
      {s.libelle}
    </span>
  );
}
