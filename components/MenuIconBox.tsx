import type { LucideIcon } from 'lucide-react';

/** Conteneur d’icône neutre + rotation au survol (menus header). */
export function MenuIconBox({
  icon: Icon,
  size = 16,
  compact = false,
  className = '',
}: {
  icon: LucideIcon;
  size?: number;
  compact?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-lg border border-black/6 bg-white text-gray-600 transition-all duration-300 ease-out motion-safe:group-hover:-rotate-12 motion-safe:group-hover:scale-110 group-hover:border-accent/20 group-hover:text-accent-dark ${
        compact ? 'h-8 w-8' : 'h-9 w-9'
      } ${className}`}
    >
      <Icon size={compact ? 15 : size} strokeWidth={1.75} aria-hidden />
    </span>
  );
}
