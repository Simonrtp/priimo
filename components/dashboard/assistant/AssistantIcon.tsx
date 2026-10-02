import { Sparkle } from 'lucide-react';

/** L’étoile à 4 branches, l’icône IA de base. */
export default function AssistantIcon({
  size = 18,
  className = '',
}: {
  size?: number;
  className?: string;
}) {
  return <Sparkle size={size} strokeWidth={2.2} className={`shrink-0 ${className}`} aria-hidden />;
}
