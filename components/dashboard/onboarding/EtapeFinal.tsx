'use client';

import { OnboardingPrimaryButton } from './OnboardingShell';

/** Écran final — débloque la navigation. */
export default function EtapeFinal({
  prenom,
  enCours,
  onOuvrir,
}: {
  prenom: string;
  enCours: boolean;
  onOuvrir: () => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col items-center justify-center px-6 text-center">
      <p className="onb-serif onb-fade max-w-[16ch] text-[36px] leading-[1.3] text-[#1A1A1A] md:text-[44px]">
        C’est à vous, {prenom.trim() || 'toi'}.
      </p>
      <div className="onb-fade mt-10 w-full [animation-delay:120ms]">
        <OnboardingPrimaryButton onClick={onOuvrir} disabled={enCours}>
          {enCours ? 'Ouverture…' : 'Ouvrir Priimo'}
        </OnboardingPrimaryButton>
      </div>
    </div>
  );
}
