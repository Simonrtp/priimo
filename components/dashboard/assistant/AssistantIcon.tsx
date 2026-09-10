/**
 * La marque de l'assistant : le robot en deux traits, comme les cartes de
 * l'Accueil. Le dessin plat au repos, le même dessin cerné d'un contour marqué
 * au survol — même sujet, même cadrage, seul le trait change.
 *
 * Le fondu se déclenche sur `group/assistant` : un parent qui ne porte pas ce
 * groupe garde le dessin plat, ce qui est le bon comportement pour une icône
 * posée dans un en-tête ou un état vide, où il n'y a rien à survoler.
 *
 * Fichiers : /public/ia.png et /public/ia-contour.png (fond transparent).
 */
export default function AssistantIcon({
  size = 18,
  className = '',
}: {
  size?: number;
  className?: string;
}) {
  const commun =
    'absolute inset-0 size-full object-contain transition-opacity duration-fluid ease-soft motion-reduce:transition-none';

  return (
    <span
      aria-hidden
      className={`relative inline-block shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      {/* eslint-disable @next/next/no-img-element -- petite marque locale, pas besoin d'optimizer */}
      <img
        src="/ia.png"
        alt=""
        width={size}
        height={size}
        draggable={false}
        className={`${commun} group-hover/assistant:opacity-0`}
      />
      <img
        src="/ia-contour.png"
        alt=""
        width={size}
        height={size}
        draggable={false}
        className={`${commun} opacity-0 group-hover/assistant:opacity-100`}
      />
      {/* eslint-enable @next/next/no-img-element */}
    </span>
  );
}
