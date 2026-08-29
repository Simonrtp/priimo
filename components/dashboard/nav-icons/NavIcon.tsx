'use client';

type Props = { active?: boolean; className?: string };

const base = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true as const,
};

export function IconAccueil({ active, className }: Props) {
  return (
    <svg {...base} className={`nav-ico ico-accueil ${active ? 'is-active' : ''} ${className ?? ''}`}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <path d="M3 10h18" />
      <path
        className="tick"
        d="M8.5 15.5l2.5 2.5 4.5-4.5"
        strokeWidth="2"
        strokeDasharray="14"
        strokeDashoffset="14"
      />
    </svg>
  );
}

export function IconProspection({ active, className }: Props) {
  return (
    <svg {...base} className={`nav-ico ico-prosp ${active ? 'is-active' : ''} ${className ?? ''}`}>
      <circle cx="12" cy="12" r="10" />
      <circle className="ring" cx="12" cy="12" r="6" />
      <circle className="dot" cx="12" cy="12" r="2" fill="currentColor" stroke="none" opacity="0.3" />
    </svg>
  );
}

export function IconEstimation({ active, className }: Props) {
  return (
    <svg {...base} className={`nav-ico ico-estim ${active ? 'is-active' : ''} ${className ?? ''}`}>
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <rect className="scr" x="7" y="5" width="10" height="4" rx="1" fill="currentColor" stroke="none" opacity="0" />
      <path d="M7 5h10v4H7z" />
      <path className="k ka" d="M8 13h.01" />
      <path className="k kb" d="M12 13h.01" />
      <path className="k kc" d="M16 13h.01" />
      <path className="k kd" d="M8 17h.01" />
      <path className="k ke" d="M12 17h.01" />
      <path className="eq" d="M15 17h2" strokeWidth="2" opacity="0" />
    </svg>
  );
}

export function IconCarte({ active, className }: Props) {
  return (
    <svg {...base} className={`nav-ico ico-carte ${active ? 'is-active' : ''} ${className ?? ''}`}>
      <path className="v1" d="M3 6l6-3v15l-6 3z" />
      <path className="v2" d="M9 3l6 3v15l-6-3z" />
      <path className="v3" d="M15 6l6-3v15l-6 3z" />
      <circle className="pin" cx="12" cy="11" r="2" fill="currentColor" stroke="none" opacity="0" />
    </svg>
  );
}

export function IconContacts({ active, className }: Props) {
  return (
    <svg {...base} className={`nav-ico ico-contacts ${active ? 'is-active' : ''} ${className ?? ''}`}>
      <g className="pA">
        <circle cx="9" cy="8" r="3.2" />
        <path d="M3.5 20c0-3.1 2.5-5.2 5.5-5.2s5.5 2.1 5.5 5.2" />
      </g>
      <g className="pB">
        <circle cx="17" cy="9" r="2.7" />
        <path d="M15.2 20c0-2.7 1.8-4.5 3.8-4.5s3.8 1.8 3.8 4.5" />
      </g>
    </svg>
  );
}

export function IconBiens({ active, className }: Props) {
  return (
    <svg {...base} className={`nav-ico ico-biens ${active ? 'is-active' : ''} ${className ?? ''}`}>
      <path d="M4 21V7l8-4 8 4v14" />
      <path d="M2 21h20" />
      <rect className="lt l1" x="7.5" y="9" width="3" height="3" fill="currentColor" stroke="none" opacity="0.15" />
      <rect className="lt l2" x="13.5" y="9" width="3" height="3" fill="currentColor" stroke="none" opacity="0.15" />
      <rect className="lt l3" x="7.5" y="14" width="3" height="3" fill="currentColor" stroke="none" opacity="0.15" />
      <rect className="lt l4" x="13.5" y="14" width="3" height="3" fill="currentColor" stroke="none" opacity="0.15" />
    </svg>
  );
}

export function IconParametres({ active, className }: Props) {
  return (
    <svg {...base} className={`nav-ico ico-param ${active ? 'is-active' : ''} ${className ?? ''}`}>
      <path
        className="cog"
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
      />
      <circle className="hub" cx="12" cy="12" r="3" fill="currentColor" stroke="none" opacity="0" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
