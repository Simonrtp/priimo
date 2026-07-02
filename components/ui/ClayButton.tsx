import { forwardRef } from 'react';

type ClayButtonVariant = 'primary' | 'secondary';

interface ClayButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ClayButtonVariant;
}

/**
 * Bouton clay — PRIIMO_DESIGN_SYSTEM.md §6.2 (primaire) / §6.3 (secondaire).
 * - primary   : dégradé de marque indigo→violet, ombre colorée (--clay-primary).
 * - secondary : surface blanche clay, texte primaire.
 * Les deux portent les interactions signature (hover remonte, press s'enfonce)
 * et un focus clavier visible (§7.2, accessibilité).
 */
const BASE =
  'inline-flex items-center justify-center gap-2 rounded-clay px-5 py-3 font-semibold ' +
  'transition-[transform,box-shadow] duration-200 ease-clay ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-400 ' +
  'disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0';

const VARIANTS: Record<ClayButtonVariant, string> = {
  primary:
    'text-white bg-gradient-to-br from-primary-500 to-violet-500 shadow-clay-primary ' +
    'hover:-translate-y-0.5 hover:brightness-105 ' +
    'active:translate-y-0 active:scale-[0.98] active:shadow-clay-pressed',
  secondary:
    'text-primary-600 bg-surface shadow-clay-sm ' +
    'hover:shadow-clay hover:-translate-y-0.5 ' +
    'active:shadow-clay-pressed active:translate-y-0',
};

const ClayButton = forwardRef<HTMLButtonElement, ClayButtonProps>(function ClayButton(
  { variant = 'primary', className = '', type = 'button', children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`${BASE} ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
});

export default ClayButton;
