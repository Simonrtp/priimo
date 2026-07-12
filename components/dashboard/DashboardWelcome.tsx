'use client';

import { useEffect, useState } from 'react';
import { pickDashboardWelcomeMessage } from '@/lib/dashboard-welcome';

type DashboardWelcomeProps = {
  firstName: string;
  className?: string;
};

export default function DashboardWelcome({ firstName, className = '' }: DashboardWelcomeProps) {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setMessage(pickDashboardWelcomeMessage(firstName));
  }, [firstName]);

  const baseClass =
    'font-display text-pretty font-medium leading-snug text-[var(--text-strong)] text-[17px] md:text-[19px]';

  if (!message) {
    return (
      <p className={`${baseClass} min-h-[1.35rem] ${className}`} aria-hidden>
        &nbsp;
      </p>
    );
  }

  return (
    <p className={`${baseClass} ${className}`} aria-live="polite">
      {message}
    </p>
  );
}
