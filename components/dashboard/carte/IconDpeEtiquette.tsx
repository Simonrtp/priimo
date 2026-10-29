const CONTOUR = '#1F2A44';

/** Une barre d'étiquette : arrondie à gauche, en pointe à droite. */
function barre(y: number, largeur: number): string {
  const x = 8;
  const pointe = 6;
  return `M${x + 3} ${y} H${x + largeur - pointe} L${x + largeur} ${y + 7} L${x + largeur - pointe} ${y + 14} H${x + 3} Q${x} ${y + 14} ${x} ${y + 11} V${y + 3} Q${x} ${y} ${x + 3} ${y} Z`;
}

const BARRES = [
  { y: 8, largeur: 34, fond: '#2DB75B' },
  { y: 25, largeur: 44, fond: '#FFC929' },
  { y: 42, largeur: 54, fond: '#F0443B' },
] as const;

/** L'étiquette énergie, en trois barres vert, jaune, rouge cernées de sombre, un peu de travers. */
export default function IconDpeEtiquette({
  className = 'size-9',
  title = 'Diagnostic de performance énergétique',
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      role="img"
      aria-label={title}
      overflow="visible"
    >
      <title>{title}</title>
      <g transform="rotate(-9 32 32)" strokeLinejoin="round" strokeLinecap="round">
        {BARRES.map(({ y, largeur, fond }) => (
          <g key={y}>
            <path d={barre(y, largeur)} fill={fond} stroke={CONTOUR} strokeWidth="2.6" />
            {/* Reflet : la barre sort du plat sans ajouter de couleur. */}
            <path d={`M${12} ${y + 3.6} H${8 + largeur - 12}`} stroke="#FFFFFF" strokeOpacity="0.5" strokeWidth="2" />
          </g>
        ))}
      </g>
    </svg>
  );
}
