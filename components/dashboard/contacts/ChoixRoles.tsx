'use client';

import { Check } from 'lucide-react';
import type { ContactType } from '@/types/contact';
import { CONTACT_TYPE_LABELS, repartirRoles, rolesDuContact } from '@/types/contact';

/** « Autre » n'est pas un choix : c'est ce qui reste quand rien n'est coché. */
const ROLES_PROPOSES: readonly ContactType[] = ['vendeur', 'acquereur', 'locataire', 'gardien', 'commercant'];

/**
 * Les casquettes d'une personne, cumulables : une vendeuse qui cherche aussi à
 * acheter coche les deux. Le rôle principal se déduit (le vendeur d'abord).
 */
export default function ChoixRoles({
  type,
  autresTypes,
  onChange,
  nouveaux = [],
  disabled = false,
  idPrefix,
}: {
  type: ContactType;
  autresTypes: readonly ContactType[];
  onChange: (next: { type: ContactType; autresTypes: ContactType[] }) => void;
  /** Rôles apportés par la note : marqués pour que l'agent voie ce qui change. */
  nouveaux?: readonly ContactType[];
  disabled?: boolean;
  idPrefix: string;
}) {
  const actifs: ContactType[] = rolesDuContact({ type, autresTypes }).filter((r) => r !== 'autre');

  function basculer(role: ContactType) {
    const suivants = actifs.includes(role) ? actifs.filter((r) => r !== role) : [...actifs, role];
    onChange(repartirRoles(suivants.length ? suivants : ['autre']));
  }

  return (
    <div role="group" aria-labelledby={`${idPrefix}-roles-label`}>
      <p id={`${idPrefix}-roles-label`} className="mb-1.5 text-[13px] font-medium text-text-strong">
        Rôles <span className="font-normal text-text-subtle">· plusieurs possibles</span>
      </p>
      <div className="flex flex-wrap gap-1.5">
        {ROLES_PROPOSES.map((role) => {
          const actif = actifs.includes(role);
          const nouveau = actif && nouveaux.includes(role);
          return (
            <button
              key={role}
              type="button"
              disabled={disabled}
              aria-pressed={actif}
              onClick={() => basculer(role)}
              className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold transition-colors duration-fluid-subtle ease-in-out disabled:opacity-50 ${
                actif
                  ? 'bg-[#1a2a56] text-white shadow-clay-sm'
                  : 'border border-black/[0.10] bg-surface text-text-muted hover:text-text-strong'
              }`}
            >
              {actif ? <Check size={13} strokeWidth={2.6} aria-hidden /> : null}
              {CONTACT_TYPE_LABELS[role]}
              {nouveau ? (
                <span className="rounded-full bg-white/20 px-1.5 text-[10.5px] font-bold uppercase tracking-wide">
                  Nouveau
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
