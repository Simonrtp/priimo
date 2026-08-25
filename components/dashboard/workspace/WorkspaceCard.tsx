import type { HTMLAttributes } from 'react';

/**
 * Le motif de carte unique de l'espace de travail. Aujourd'hui, Contacts et
 * Biens l'utilisent sans exception : c'est ce qui rend l'outil reconnaissable
 * d'un écran à l'autre.
 */
export default function WorkspaceCard({
  className = '',
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-clay border border-black/[0.06] bg-surface px-4 py-4 shadow-clay-sm sm:px-6 sm:py-5 ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

/** Étiquette en petites capitales qui coiffe une carte ou une section. */
export function CardEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="font-semibold uppercase text-text-subtle"
      style={{ fontSize: 11, letterSpacing: '0.08em' }}
    >
      {children}
    </p>
  );
}
