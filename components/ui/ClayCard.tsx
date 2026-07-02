import { forwardRef } from 'react';

interface ClayCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Ajoute le feedback tactile (hover remonte, press s'enfonce) — §6.1 / §7.2. */
  clickable?: boolean;
  /** Padding interne — la charte recommande p-5/p-6 pour une carte clay (§5). */
  padding?: 'sm' | 'md' | 'lg' | 'none';
  as?: 'div' | 'button' | 'a';
}

const PADDING: Record<NonNullable<ClayCardProps['padding']>, string> = {
  none: '',
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
};

/**
 * Carte clay (surface de base) — PRIIMO_DESIGN_SYSTEM.md §6.1.
 * Encapsule le style clay : conteneur en relief, arrondi généreux, ombre douce.
 * La variante `clickable` ajoute les interactions signature (hover/press).
 */
const ClayCard = forwardRef<HTMLDivElement, ClayCardProps>(function ClayCard(
  { clickable = false, padding = 'lg', className = '', children, ...rest },
  ref,
) {
  const interactive = clickable
    ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-clay-lg active:translate-y-0 active:shadow-clay-pressed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-400'
    : '';

  return (
    <div
      ref={ref}
      className={`rounded-clay-lg bg-surface shadow-clay transition-[transform,box-shadow] duration-200 ease-clay ${PADDING[padding]} ${interactive} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
});

export default ClayCard;
