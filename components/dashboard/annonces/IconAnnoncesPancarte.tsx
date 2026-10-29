/** Pancarte « À vendre » — icône Annonces, bleu Priimo + pastille rouge. */
export default function IconAnnoncesPancarte({
  className = 'size-9',
  title = 'Annonces',
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
      overflow="visible"
    >
      <title>{title}</title>
      {/* Piquet */}
      <rect x="29.5" y="36" width="5" height="22" rx="2" fill="#1A2A56" />
      {/* Pancarte (marge intérieure pour que le stroke ne soit pas coupé) */}
      <rect x="12" y="10" width="40" height="28" rx="5" fill="#2A3D6E" stroke="#1A2A56" strokeWidth="2.5" />
      <rect x="16" y="14" width="32" height="20" rx="3.5" fill="#F4F1EA" />
      {/* Texte stylisé */}
      <rect x="21" y="18.5" width="16" height="3.2" rx="1.6" fill="#1A2A56" />
      <rect x="21" y="25" width="12" height="3.2" rx="1.6" fill="#1A2A56" />
      <circle cx="40" cy="26.5" r="4.5" fill="#E30513" stroke="#1A2A56" strokeWidth="1.8" />
    </svg>
  );
}
