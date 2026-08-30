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
          Un agent immobilier passe deux heures par jour à faire ce pour quoi
          il n’a pas signé : ressaisir, chercher, remplir, recommencer. Deux
          heures qui ne rapportent rien à personne.
        </p>
        <p className="mb-5">
          Priimo est né de là. On a repris la journée entière — trouver les
          vendeurs, sortir sur le terrain, noter, relancer, estimer, signer —
          et on l’a refaite dans un seul outil, en enlevant tout ce qui était
          pénible.
        </p>
        <p className="mb-5">
          Vous dictez en marchant, c’est rangé. Vous arrivez devant un
          immeuble, vous savez déjà ce qui s’y est vendu. Vous rentrez le soir,
          il n’y a rien à saisir : c’est déjà fait.
        </p>
        <p className="mb-8">
          Ce que vous y gagnez, c’est du temps. Et dans ce métier, le temps se
          transforme en mandats.
        </p>
        <p className="onb-serif text-[18px] text-[#1A1A1A]">— L’équipe Priimo</p>
      </article>

      <div className="onb-fade mt-auto pt-10 [animation-delay:160ms]">
        <OnboardingPrimaryButton onClick={onSuivant}>Continuer</OnboardingPrimaryButton>
      </div>
    </div>
  );
}
