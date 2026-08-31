'use client';

import { useEffect, useState } from 'react';

/** Vrai tant que la prise en main agent est affichée dans le workspace. */
export function useOnboardingNavLock(): boolean {
  const [locked, setLocked] = useState(false);
  useEffect(() => {
    const check = () => setLocked(Boolean(document.querySelector('[data-agent-onboarding]')));
    check();
    const mo = new MutationObserver(check);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, []);
  return locked;
}
