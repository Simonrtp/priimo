'use client';

import type { MouseEvent } from 'react';
import { formatPhoneDisplay, telHref } from '@/lib/import/normalize';
import { NUMERO_NON_CONSENTI } from '@/lib/recontact/consent';

const NUMBER = 'tabular-nums font-medium text-[#3D5A80]';

export function NumeroAffiche({
  phone,
  consenti,
  label,
  className = '',
  onClick,
}: {
  phone: string;
  consenti: boolean;
  label?: string;
  className?: string;
  onClick?: (e: MouseEvent) => void;
}) {
  const display = formatPhoneDisplay(phone);
  if (consenti) {
    return (
      <a
        href={telHref(phone)}
        className={`inline-flex min-h-10 items-center ${NUMBER} underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 ${className}`}
        aria-label={label ? `Appeler ${label}` : `Appeler ${display}`}
        onClick={onClick}
      >
        {display}
      </a>
    );
  }
  return (
    <span className={`inline-flex min-h-10 flex-wrap items-center gap-x-2 gap-y-0.5 ${className}`}>
      <span className={`${NUMBER} tabular-nums`}>{display}</span>
      <span className="text-[11px] font-medium text-text-muted">{NUMERO_NON_CONSENTI}</span>
    </span>
  );
}

export function EmailAffiche({
  email,
  consenti,
  label,
  className = '',
}: {
  email: string;
  consenti: boolean;
  label?: string;
  className?: string;
}) {
  if (consenti) {
    return (
      <a
        href={`mailto:${email}`}
        className={`inline-flex min-h-10 items-center font-medium text-[#3D5A80] underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 ${className}`}
        aria-label={label ? `Écrire à ${label}` : `Écrire à ${email}`}
      >
        {email}
      </a>
    );
  }
  return <span className={className}>{email}</span>;
}

export function BadgeNumeroNonConsenti({ className = '' }: { className?: string }) {
  return (
    <span className={`text-[11px] font-medium text-text-muted ${className}`}>{NUMERO_NON_CONSENTI}</span>
  );
}
