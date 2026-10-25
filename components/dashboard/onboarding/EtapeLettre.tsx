'use client';

import { OnboardingPrimaryButton } from './OnboardingShell';
import { FONCTIONNALITES } from './fonctionnalites';

/**
 * Écran 2 — ce que Priimo fait, dit au collaborateur qui vient d’ouvrir son accès.
 */
export default function EtapeLettre({
  prenom,
  onSuivant,
}: {
  prenom: string;
  onSuivant: () => void;
}) {
  const name = prenom.trim();

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-10 md:px-10 md:pt-12 lg:px-14">
      <article className="onb-letter onb-fade w-full">
        {name ? <p className="mb-5">{name},</p> : null}
        <p className="mb-5">
          Priimo est l’outil de prospection de votre agence. Sur votre secteur, il
          réunit ce qui sert à préparer une visite : les diagnostics énergétiques,
          les ventes déjà signées et le cadastre. Chaque adresse arrive avec
          l’essentiel, avant que vous sonniez.
        </p>
        <p className="mb-5">
          Les adresses de votre secteur vous sont attribuées. Une note que vous
          dictez en tournée est retranscrite et rangée. Le soir, vos dossiers sont
          à jour, sans avoir à tout ressaisir.
        </p>
        <p className="mb-4">Concrètement :</p>
        <ul className="mb-8 list-none space-y-2.5 p-0">
          {FONCTIONNALITES.map((ligne) => (
            <li
              key={ligne.texte}
              className={`flex gap-3 ${'bientot' in ligne ? 'text-[#8A8A8A]' : ''}`}
            >
              <span
                className={`mt-[0.7em] size-1.5 shrink-0 rounded-full ${
                  'bientot' in ligne ? 'bg-[#C4C4C4]' : 'bg-[#E8743C]'
                }`}
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                {ligne.texte}
                {'bientot' in ligne ? (
                  <span className="ml-2 inline-flex cursor-default items-center rounded-full bg-black/[0.06] px-2.5 py-0.5 align-middle text-[12px] font-semibold tracking-normal">
                    À venir
                  </span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
        <p className="onb-serif text-[18px] text-[#1A1A1A]">— L’équipe Priimo</p>
      </article>

      <div className="onb-fade mt-auto pt-10 [animation-delay:160ms]">
        <OnboardingPrimaryButton onClick={onSuivant}>Continuer</OnboardingPrimaryButton>
      </div>
    </div>
  );
}
