'use client';

import { useEffect, useState } from 'react';
import { pickDashboardWelcomeMessage } from '@/lib/dashboard-welcome';

export default function DashboardWelcome({ firstName }: { firstName: string }) {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setMessage(pickDashboardWelcomeMessage(firstName));
  }, [firstName]);

  if (!message) {
    return (
      <p
        className="mb-3 min-h-[1.25rem] text-[15px] font-medium leading-snug text-ink md:mb-4 md:text-base"
        aria-hidden
      >
        &nbsp;
      </p>
    );
  }

  return (
    <p className="mb-3 text-[15px] font-medium leading-snug text-ink md:mb-4 md:text-base">
      {message}
    </p>
  );
}
