import type { ButtonHTMLAttributes, ReactNode } from 'react';
import ChargementBouton from '@/components/ui/ChargementBouton';

export type WorkspaceButtonVariant = 'primary' | 'secondary' | 'create';

/**
 * Capsules de l’espace de travail. Même dessin partout : pilule pleine,
 * Nunito semibold, rien d’autre.
 * - create    : orange, comme « Nouveau » — ajouter / créer
 * - primary   : marine — valider, confirmer, terminer
 * - secondary : contour — importer, exporter, annuler
 *
 * `busy` : navette Priimo (ardoise + barre orange), un seul langage d’attente.
 */
export const WORKSPACE_BTN_BASE =
  'inline-flex min-h-9 items-center justify-center gap-2 whitespace-nowrap rounded-full px-3.5 py-2 font-nunito text-[13px] font-semibold transition-colors duration-fluid-subtle ease-in-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:px-4';

export const WORKSPACE_BTN_SKIN: Record<WorkspaceButtonVariant, string> = {
  create: 'bg-accent text-white hover:bg-accent-dark focus-visible:outline-accent',
  primary: 'bg-[#1a2a56] text-white hover:bg-[#152348] focus-visible:outline-[#1a2a56]',
  secondary:
    'border border-black/[0.12] bg-surface text-text hover:bg-black/[0.03] focus-visible:outline-[#1a2a56]',
};

const BUSY_LABEL_DEFAUT = 'Un instant.';

type WorkspaceButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: WorkspaceButtonVariant;
  busy?: boolean;
  busyLabel?: string;
  children?: ReactNode;
};

export default function WorkspaceButton({
  variant = 'primary',
  busy = false,
  busyLabel = BUSY_LABEL_DEFAUT,
  className = '',
  children,
  disabled,
  type = 'button',
  ...rest
}: WorkspaceButtonProps) {
  const enAttente = Boolean(busy);

  return (
    <button
      type={type}
      disabled={disabled || enAttente}
      aria-busy={enAttente || undefined}
      aria-label={enAttente ? busyLabel : undefined}
      className={
        enAttente
          ? `${WORKSPACE_BTN_BASE} priimo-wait-btn priimo-wait-btn--compact ${className}`
          : `${WORKSPACE_BTN_BASE} ${WORKSPACE_BTN_SKIN[variant]} ${className}`
      }
      {...rest}
    >
      {enAttente ? <ChargementBouton size="compact" label={busyLabel} /> : children}
    </button>
  );
}
