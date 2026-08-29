'use client';

import { OnboardingPrimaryButton } from './OnboardingShell';

/**
 * Écran 2 — lettre. Serif, ~60 caractères / ligne, jusqu’au clic.
 */
export default function EtapeLettre({
  prenom,
  onSuivant,
}: {
  prenom: string;
  onSuivant: () => void;
}) {
  const name = prenom.trim() || 'toi';

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-10 md:px-8">
      <article className="onb-letter onb-fade mx-auto w-full">
        <p className="mb-5">{name},</p>
        <p className="mb-5">
          J’ai créé Priimo après avoir passé du temps avec des agents qui passaient
          leurs soirées à ressaisir dans un logiciel ce qu’ils avaient vécu dans la
          journée.
        </p>
        <p className="mb-5">
          Le métier se fait dehors, dans la rue, devant les portes. Pas devant un
          écran à 19h.
        </p>
        <p className="mb-5">
          Alors on a fait l’inverse des autres : un outil qui travaille pendant que
          vous marchez. Vous dictez, il range. Vous arrivez devant un immeuble, il
          sait déjà ce qui s’y est passé.
        </p>
        <p className="mb-8">J’espère qu’il vous rendra service.</p>
        <p className="onb-serif text-[18px] text-[#1A1A1A]">— Simon</p>
      </article>

      <div className="onb-fade mt-auto pt-10 [animation-delay:160ms]">
        <OnboardingPrimaryButton onClick={onSuivant}>Continuer</OnboardingPrimaryButton>
      </div>
    </div>
  );
}
