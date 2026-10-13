import OnboardingShell, { OnboardingPrimaryButton } from './OnboardingShell';

const FONCTIONNALITES = [
  'Voir votre secteur sur la carte : immeubles, ventes, DPE, copropriétés.',
  'Savoir quelles adresses frapper, et pourquoi, avant de sortir.',
  'Dicter une note en marchant : Priimo la range.',
  'Estimer un bien avec les ventes réelles du quartier.',
  'Suivre vos leads dans le pipeline, jusqu’au mandat.',
  'Publier un mandat une fois, sur tous les portails.',
  'Lire où l’agence avance, sans rien ressaisir le soir.',
] as const;

/** Un seul texte : tout ce que Priimo fait, puis Continuer. */
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
      titre="Ce que vous pourrez faire avec Priimo."
      action={<OnboardingPrimaryButton onClick={onSuivant}>Continuer</OnboardingPrimaryButton>}
    >
      <ul className="max-w-[36rem] space-y-3.5 text-pretty text-[16px] leading-relaxed text-[#3A3A3A] md:max-w-2xl md:space-y-4 md:text-[17px]">
        {FONCTIONNALITES.map((ligne) => (
          <li key={ligne} className="flex gap-3">
            <span className="mt-[0.55em] size-1.5 shrink-0 rounded-full bg-[#E8743C]" aria-hidden />
            <span>{ligne}</span>
          </li>
        ))}
      </ul>
    </OnboardingShell>
  );
}
