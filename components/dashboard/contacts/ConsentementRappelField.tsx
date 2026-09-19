'use client';

import { Check } from 'lucide-react';
import InfoTooltip from '@/components/ui/InfoTooltip';

export function CocheConsentementTel({
  className = '',
  size = 16,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <span
      className={`inline-flex shrink-0 text-success ${className}`}
      title="Consentement au rappel"
      aria-label="Consentement au rappel"
    >
      <Check size={size} strokeWidth={2.6} aria-hidden />
    </span>
  );
}

const POURQUOI_LA_PREUVE =
  "Depuis le 11 août 2026, le démarchage téléphonique d’un particulier est interdit sans accord préalable. C’est à l’agence de prouver que la personne a donné cet accord explicitement. Si elle n’est pas contente — réclamation, signalement — une case vague ou un accord verbal ne protège pas.";

export default function ConsentementRappelField({
  id,
  checked,
  onChange,
}: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center pl-7">
        <InfoTooltip content={POURQUOI_LA_PREUVE} placement="top-start">
          <span className="inline-flex size-5 items-center justify-center rounded-full border border-black/20 text-[11px] font-semibold leading-none text-text-muted">
            ?
            <span className="sr-only">Pourquoi cette case</span>
          </span>
        </InfoTooltip>
      </div>
      <label htmlFor={id} className="flex cursor-pointer items-start gap-2.5">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 size-4 rounded border-black/20"
        />
        <span className="text-pretty text-[13.5px] font-medium leading-snug text-text">
          La personne a explicitement consenti à ce que ce numéro serve à la rappeler.
        </span>
      </label>
    </div>
  );
}
