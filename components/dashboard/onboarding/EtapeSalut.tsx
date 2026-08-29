'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Écran 1 — salut puis phrase d’accueil.
 * Auto-avance 2,2 s × 2. Clic = suite immédiate. Aucune icône.
 */
export default function EtapeSalut({
  prenom,
  onSuivant,
}: {
  prenom: string;
  onSuivant: () => void;
}) {
  const [phase, setPhase] = useState<0 | 1>(0);
  const advanced = useRef(false);

  const go = () => {
    if (advanced.current) return;
    advanced.current = true;
    onSuivant();
  };

  useEffect(() => {
    const t1 = window.setTimeout(() => setPhase(1), 2200);
    const t2 = window.setTimeout(() => go(), 4400);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- timers once on mount
  }, []);

  const text =
    phase === 0
      ? `Bonjour ${prenom || 'toi'}.`
      : 'Bienvenue sur ton futur outil préféré.';

  return (
    <button
      type="button"
      onClick={go}
      className="flex h-full min-h-0 w-full flex-1 cursor-default flex-col items-center justify-center px-6 text-center"
      aria-label="Continuer"
    >
      <p
        key={phase}
        className="onb-serif onb-fade max-w-[18ch] text-[36px] leading-[1.3] text-[#1A1A1A] md:text-[48px]"
      >
        {text}
      </p>
    </button>
  );
}
