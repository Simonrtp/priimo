/**
 * Marque Prim'IA — robot dédié à l'assistant.
 * Fichier : /public/prim-ia.png (fond transparent).
 */
export default function PrimIaIcon({
  size = 18,
  className = '',
}: {
  size?: number;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- petite marque locale, pas besoin d'optimizer
    <img
      src="/prim-ia.png"
      alt=""
      width={size}
      height={size}
      className={`object-contain ${className}`}
      style={{ width: size, height: size }}
      aria-hidden
      draggable={false}
    />
  );
}
