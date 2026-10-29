/** Maison + thermomètre — icône DPE (inline, lisible à 24–36 px). */
export default function IconDpeMaisonThermostat({
  className = 'size-9',
  title = 'Diagnostic de performance énergétique',
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      <path d="M8 30.5 L30 12 L40.5 20.2 V18.5 H46 V24.8 L52 30.5 V54 H8 V30.5 Z" fill="#1A2A56" />
      <path d="M8 30.5 L30 12 L52 30.5 H44 L30 19 L16 30.5 H8 Z" fill="#2A3D6E" />
      <rect x="24" y="38" width="12" height="16" rx="2" fill="#F4F1EA" />
      <rect x="14" y="34" width="7" height="7" rx="1.2" fill="#8BD3E8" />
      <rect x="45.5" y="22" width="6" height="26" rx="3" fill="#F4F1EA" stroke="#1A2A56" strokeWidth="1.5" />
      <circle cx="48.5" cy="50" r="6.5" fill="#E8743C" stroke="#1A2A56" strokeWidth="1.5" />
      <rect x="47.2" y="30" width="2.6" height="20" rx="1.3" fill="#E8743C" />
      <path
        d="M51.5 28h2.5M51.5 33h2.5M51.5 38h2.5M51.5 43h2.5"
        stroke="#1A2A56"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}
