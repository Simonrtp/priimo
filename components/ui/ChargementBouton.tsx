type ChargementBoutonProps = {
  label: string;
  /** auth = CTA connexion plein. compact = capsules dashboard. */
  size?: 'auth' | 'compact';
};

/**
 * Navette Priimo — attente bouton (pas un spinner).
 * Fond ardoise + barre orange qui glisse ; le parent porte `.priimo-wait-btn`.
 */
export default function ChargementBouton({ label, size = 'auth' }: ChargementBoutonProps) {
  return (
    <>
      <span
        className={`priimo-wait-track${size === 'compact' ? ' priimo-wait-track--compact' : ''}`}
        aria-hidden
      >
        <span className="priimo-wait-car" />
      </span>
      <span className="priimo-wait-copy">{label}</span>
    </>
  );
}
