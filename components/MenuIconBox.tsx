import type { LucideIcon } from 'lucide-react';

/** Conteneur d’icône neutre + rotation au survol (menus header). */
export function MenuIconBox({
  icon: Icon,
  size = 16,
  compact = false,
  large = false,
  className = '',
}: {
  icon: LucideIcon;
  size?: number;
  compact?: boolean;
  large?: boolean;
  className?: string;
}) {
  const box = large ? 'h-12 w-12 rounded-xl' : compact ? 'h-8 w-8' : 'h-9 w-9';
  const iconSize = large ? 22 : compact ? 15 : size;

  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-lg border border-black/6 bg-white text-gray-600 transition-all duration-300 ease-out motion-safe:group-hover:-rotate-12 motion-safe:group-hover:scale-110 group-hover:border-accent/20 group-hover:text-accent-dark ${box} ${className}`}
    >
      <Icon size={iconSize} strokeWidth={1.75} aria-hidden />
    </span>
  );
}
