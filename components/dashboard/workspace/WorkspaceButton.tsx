import type { ButtonHTMLAttributes } from 'react';

/**
 * Boutons de l'espace de travail. Grands, lisibles, deux variantes seulement.
 * L'orange est réservé à `primary` : c'est un signal, pas une décoration.
 */
export default function WorkspaceButton({
  variant = 'primary',
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' }) {
  const base =
    'inline-flex min-h-[40px] items-center justify-center gap-2 whitespace-nowrap rounded-clay px-4 py-2.5 text-[13.5px] font-semibold transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50 sm:px-5 sm:text-[14px]';

  const skin =
    variant === 'primary'
      ? 'bg-accent text-white hover:bg-accent-dark'
      : 'border border-black/[0.12] bg-surface text-text hover:bg-black/[0.03]';

  return <button className={`${base} ${skin} ${className}`} {...rest} />;
}
