import type { Metadata } from 'next';
import Link from 'next/link';
import { PriimoLogo } from '@/components/brand/PriimoLogo';

export const metadata: Metadata = {
  title: 'Page introuvable',
  robots: { index: false, follow: false },
};

const LIENS = [
  { href: '/', label: 'Accueil' },
  { href: '/login', label: 'Se connecter' },
  { href: '/blog', label: 'Le blog' },
  { href: '/a-propos', label: 'À propos' },
] as const;

export default function PageIntrouvable() {
  return (
    <main className="min-h-dvh bg-white text-blue">
      <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-6 py-8 sm:px-10 lg:px-14">
        <Link href="/" aria-label="Priimo" className="w-fit rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue">
          <PriimoLogo priority className="h-10 sm:h-11" />
        </Link>

        <div className="flex flex-1 flex-col items-center justify-center gap-10 lg:flex-row lg:items-center lg:justify-between lg:gap-16">
          <div className="w-full max-w-md">
            <h1 className="text-balance font-display text-6xl font-bold leading-none sm:text-7xl">Oups.</h1>
            <p className="mt-6 text-pretty font-display text-2xl font-semibold leading-snug text-blue sm:text-[1.7rem]">
              Cette page a déménagé sans laisser d’adresse.
            </p>
            <p className="mt-4 text-pretty text-[17px] leading-relaxed text-blue-light">
              On a sonné. Lumière éteinte, paillasson rentré. Le voisin jure qu’il faisait la sieste.
            </p>
            <p className="mt-8 text-sm font-semibold text-blue-light">Erreur 404</p>
            <p className="mt-6 text-[15px] text-blue">Quelques adresses qui répondent encore :</p>
            <ul className="mt-3 flex flex-col gap-2">
              {LIENS.map((lien) => (
                <li key={lien.href}>
                  <Link
                    href={lien.href}
                    className="text-[15px] font-semibold text-accent underline decoration-accent/30 underline-offset-4 hover:decoration-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue"
                  >
                    {lien.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <MaisonQuiFile />
        </div>
      </div>
    </main>
  );
}

function MaisonQuiFile() {
  return (
    <svg
      viewBox="0 0 480 520"
      className="h-auto w-full max-w-[420px] shrink-0"
      aria-hidden
    >
      <ellipse cx="262" cy="468" rx="138" ry="16" fill="#E7EBF4" />
      <g stroke="#C5CDDE" strokeWidth="5" strokeLinecap="round">
        <path d="M132 268h32" />
        <path d="M118 302h44" />
        <path d="M140 336h24" />
      </g>
      <g transform="translate(78 348)">
        <rect width="64" height="50" rx="12" fill="#E8743C" />
        <path d="M20 0v-8a12 12 0 0 1 24 0V0" fill="none" stroke="#E8743C" strokeWidth="5" />
        <rect x="8" y="18" width="48" height="5" rx="2.5" fill="#C25E2C" />
        <text x="32" y="40" textAnchor="middle" fill="#fff" fontSize="13" fontWeight="700" fontFamily="var(--font-display), system-ui, sans-serif">
          404
        </text>
      </g>
      <g transform="translate(268 268) rotate(-8)">
        <rect x="-78" y="78" width="24" height="86" rx="12" fill="#1A2A56" />
        <ellipse cx="-66" cy="168" rx="22" ry="11" fill="#E8743C" />
        <rect x="36" y="92" width="24" height="70" rx="12" fill="#1A2A56" />
        <ellipse cx="56" cy="166" rx="22" ry="11" fill="#E8743C" />
        <path d="M-108 -8 L0 -104 L108 -8 Z" fill="#E8743C" />
        <rect x="-18" y="-104" width="22" height="28" rx="4" fill="#C25E2C" />
        <rect x="-96" y="-16" width="192" height="148" rx="22" fill="#1A2A56" />
        <rect x="-66" y="16" width="40" height="34" rx="8" fill="#F4F6FB" />
        <rect x="22" y="16" width="40" height="34" rx="8" fill="#F4F6FB" />
        <path d="M-66 33h40M-46 16v34M22 33h40M42 16v34" stroke="#1A2A56" strokeWidth="2" opacity="0.35" />
        <rect x="-20" y="58" width="40" height="74" rx="12" fill="#F7F8FC" />
        <circle cx="10" cy="98" r="3.5" fill="#E8743C" />
      </g>
      <g transform="translate(330 78)">
        <rect width="136" height="54" rx="20" fill="#fff" stroke="#E6EAF2" strokeWidth="2" />
        <path d="M28 54l-8 16 24-16" fill="#fff" stroke="#E6EAF2" strokeWidth="2" strokeLinejoin="round" />
        <text x="68" y="34" textAnchor="middle" fill="#1A2A56" fontSize="18" fontWeight="700" fontFamily="var(--font-display), system-ui, sans-serif">
          Je file.
        </text>
      </g>
    </svg>
  );
}
