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
  create:
    'group/create relative isolate overflow-hidden bg-accent text-white focus-visible:outline-accent',
  primary: 'bg-[#1a2a56] text-white hover:bg-[#152348] focus-visible:outline-[#1a2a56]',
  secondary:
    'border border-black/[0.12] bg-surface text-text hover:bg-black/[0.03] focus-visible:outline-[#1a2a56]',
};

/** Même montée noire que le micro vocal — reste tant que le curseur est dessus. */
const CREATE_HOVER_NOIR =
  'pointer-events-none absolute inset-x-0 bottom-0 z-0 h-[150%] translate-y-full rounded-t-[50%_9px] bg-[#0B0F1E] transition-transform duration-[850ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/create:translate-y-0 group-focus-visible/create:translate-y-0 motion-reduce:transition-none';

const CREATE_LABEL = 'relative z-10 inline-flex items-center justify-center gap-2';

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
      {variant === 'create' && !enAttente ? <span aria-hidden className={CREATE_HOVER_NOIR} /> : null}
      {enAttente ? (
        <ChargementBouton size="compact" label={busyLabel} />
      ) : variant === 'create' ? (
        <span className={CREATE_LABEL}>{children}</span>
      ) : (
        children
      )}
    </button>
  );
}
