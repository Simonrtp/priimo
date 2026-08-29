'use client';

import { OnboardingPrimaryButton } from './OnboardingShell';
import OnboardingRevealText from './OnboardingRevealText';

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
  const name = prenom.trim() || 'toi';

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col items-center justify-center px-6 text-center">
      <OnboardingRevealText
        as="p"
        text={`C’est à vous, ${name}.`}
        staggerMs={56}
        className="onb-serif max-w-[16ch] text-[36px] leading-[1.3] text-[#1A1A1A] md:text-[44px]"
      />
      <div className="onb-fade-up mt-10 w-full [animation-delay:480ms]">
        <OnboardingPrimaryButton onClick={onOuvrir} disabled={enCours}>
          {enCours ? 'Ouverture…' : 'Ouvrir Priimo'}
        </OnboardingPrimaryButton>
      </div>
    </div>
  );
}
