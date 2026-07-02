import { scoreColor } from '@/lib/score-color';

interface ScoreBadgeProps {
  score: number;
  /** Taille visuelle du pill. */
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Badge de score « heat » — PRIIMO_DESIGN_SYSTEM.md §6.4.
 * Le badge le plus important du produit : fond teinté à ~15 %, texte dans la
 * couleur pleine (via scoreColor), léger relief clay.
 *
 * Note d'implémentation : la charte suggère `${scoreColor(score)}22` pour le
 * fond, ce qui n'est pas valide avec une variable CSS — on obtient le même
 * effet (≈15 %) via color-mix, sans inventer de couleur hors token.
 */
export default function ScoreBadge({ score, size = 'md', className = '' }: ScoreBadgeProps) {
  const color = scoreColor(score);
  const sizeClasses = size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-sm';

  return (
    <span
      className={`inline-flex items-center justify-center gap-1 rounded-full font-bold tabular-nums shadow-clay-sm ${sizeClasses} ${className}`}
      style={{
        color,
        backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`,
      }}
      aria-label={`Score ${score}`}
    >
      {score}
    </span>
  );
}
