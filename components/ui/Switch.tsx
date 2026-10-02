/**
 * Interrupteur on/off (bulle) — pas de libellé « on / off ».
 * Actif = navy Priimo (`#1A2A56`).
 *
 * Sans gestionnaire : purement décoratif (la rangée parente porte le clic).
 */
export default function Switch({
  checked,
  onChange,
  className = '',
  'aria-label': ariaLabel,
}: {
  checked: boolean;
  onChange?: (next: boolean) => void;
  className?: string;
  'aria-label'?: string;
}) {
  const track = `relative inline-flex h-[22px] w-[40px] shrink-0 items-center rounded-full transition-colors duration-200 ease-out ${
    checked ? 'bg-[#1A2A56]' : 'bg-black/[0.14]'
  } ${className}`;
  const thumb = (
    <span
      aria-hidden
      className={`pointer-events-none absolute top-[3px] size-4 rounded-full bg-white shadow-[0_1px_3px_rgba(15,23,42,0.28)] transition-transform duration-200 ease-out ${
        checked ? 'translate-x-[20px]' : 'translate-x-[3px]'
      }`}
    />
  );

  if (!onChange) {
    return (
      <span className={track} aria-hidden>
        {thumb}
      </span>
    );
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      className={`${track} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1A2A56]`}
    >
      {thumb}
    </button>
  );
}
