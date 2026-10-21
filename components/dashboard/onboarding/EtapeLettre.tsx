'use client';

import { OnboardingPrimaryButton } from './OnboardingShell';
import { FONCTIONNALITES } from './fonctionnalites';

/**
 * Écran 2 — ce que Priimo fait. Technique, vouvoiement, jusqu’au clic.
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
          Priimo est le CRM de pige et de terrain de l’agence. Il croise les bases
          publiques — DPE ADEME, ventes DVF, cadastre IGN — et les pose sur votre
          secteur. Chaque adresse arrive déjà qualifiée : signaux, historique,
          notes déjà prises.
        </p>
        <p className="mb-5">
          Les leads se livrent dans le secteur qui contient l’adresse. Ce que vous
          dictez en tournée est transcrit et classé. Le soir, le pipeline et le
          suivi d’activité sont à jour, sans ressaisie.
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
