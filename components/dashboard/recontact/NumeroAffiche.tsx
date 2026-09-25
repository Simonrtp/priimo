'use client';

import type { MouseEvent } from 'react';
import { formatPhoneDisplay, telHref } from '@/lib/import/normalize';

const NUMBER = 'tabular-nums font-medium text-[#1A2A56]';

export function NumeroAffiche({
  phone,
  label,
  className = '',
  onClick,
}: {
  phone: string;
  label?: string;
  className?: string;
  onClick?: (e: MouseEvent) => void;
}) {
  const display = formatPhoneDisplay(phone);
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

export function EmailAffiche({
  email,
  label,
  className = '',
}: {
  email: string;
  label?: string;
  className?: string;
}) {
  return (
    <a
      href={`mailto:${email}`}
      className={`inline-flex min-h-10 items-center font-medium text-[#1A2A56] underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 ${className}`}
      aria-label={label ? `Écrire à ${label}` : `Écrire à ${email}`}
    >
      {email}
    </a>
  );
}
