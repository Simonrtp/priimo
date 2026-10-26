/**
 * Panneau orange, point d'exclamation noir. Le signe d'un petit
 * problème à régler : fiche incomplète, note non rattachée, doublon…
 *
 * Un seul dessin partout — pas d'icône Lucide à la place.
 */
export const FOND_ALERTE = '#FFD2A8';
export const FOND_ALERTE_SURVOL = '#FFC48E';
export const FOND_ALERTE_OUVERT = '#FFC89A';

export default function PanneauAlerte({
  size = 16,
  label = 'À compléter',
  className = '',
}: {
  size?: number;
  /** `null` : décoratif (le texte voisin porte le sens). */
  label?: string | null;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      className={`shrink-0 ${className}`}
      role={label ? 'img' : undefined}
      aria-label={label ?? undefined}
      aria-hidden={label ? undefined : true}
    >
      <path
        d="M10 2.15 18.55 17.2H1.45Z"
        fill="#F5A623"
        stroke="#1A1A1A"
        strokeWidth="1.35"
        strokeLinejoin="round"
      />
      <path d="M10 7.15v5.05" stroke="#1A1A1A" strokeWidth="1.85" strokeLinecap="round" />
      <circle cx="10" cy="14.55" r="1.05" fill="#1A1A1A" />
    </svg>
  );
}
