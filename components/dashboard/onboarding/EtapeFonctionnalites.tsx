import OnboardingShell, { OnboardingPrimaryButton } from './OnboardingShell';
import { FONCTIONNALITES } from './fonctionnalites';

/** Recapitulatif technique — même fond que la lettre, pour une reprise d’étape. */
export default function EtapeFonctionnalites({
  rang,
  total,
  onSuivant,
}: {
  rang: number;
  total: number;
  onSuivant: () => void;
}) {
  return (
    <OnboardingShell
      rang={rang}
      total={total}
      titre="Ce que Priimo fait."
      phrase="CRM de pige et de terrain : bases publiques sur votre secteur, notes classées, pipeline à jour."
      defile
      action={<OnboardingPrimaryButton onClick={onSuivant}>Continuer</OnboardingPrimaryButton>}
    >
      <ul className="max-w-[36rem] space-y-3.5 text-pretty text-[16px] leading-relaxed text-[#3A3A3A] md:max-w-2xl md:space-y-4 md:text-[17px]">
        {FONCTIONNALITES.map((ligne) => (
          <li
            key={ligne.texte}
            className={`flex gap-3 ${'bientot' in ligne ? 'text-text-muted' : ''}`}
          >
            <span
              className={`mt-[0.55em] size-1.5 shrink-0 rounded-full ${
                'bientot' in ligne ? 'bg-[#C4C4C4]' : 'bg-[#E8743C]'
              }`}
              aria-hidden
            />
            <span className="min-w-0 flex-1">
              {ligne.texte}
              {'bientot' in ligne ? (
                <span className="ml-2 inline-flex cursor-default items-center rounded-full bg-black/[0.06] px-2.5 py-0.5 align-middle text-[12px] font-semibold text-text-muted">
                  À venir
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </OnboardingShell>
  );
}
