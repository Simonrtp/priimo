import type { HTMLAttributes, ReactNode } from 'react';
import { ACCUEIL, type AccueilAccent } from '@/lib/today/field';

/**
 * Carte Accueil — fond blanc par défaut ; pastels réservés aux mises en avant
 * (pastels ACCUEIL dans field.ts). Texte noir sur fond pastel.
 */
export default function AccueilCard({
  accent,
  className = '',
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement> & {
  accent?: AccueilAccent;
  children: ReactNode;
}) {
  return (
    <div
      className={`rounded-[18px] px-4 py-4 sm:px-5 sm:py-5 ${
        accent ? '' : 'border border-black/[0.06] bg-surface shadow-clay-sm'
      } ${className}`}
      style={accent ? { backgroundColor: ACCUEIL[accent] } : undefined}
      {...rest}
    >
      {children}
    </div>
  );
}

/** Compteur portefeuille — fond pastel uni (sans bordure ni ombre). */
export function AccueilKpiCard({
  accent,
  className = '',
  children,
}: {
  accent: AccueilAccent;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`flex h-full min-w-0 flex-col overflow-hidden rounded-[18px] ${className}`}
      style={{ backgroundColor: ACCUEIL[accent] }}
    >
      {children}
    </div>
  );
}
