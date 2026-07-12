import Link from "next/link";
import FooterLandscapeBg from "./FooterLandscapeBg";

/** Arrondi en haut uniquement — bas plat, pleine largeur */
export const FOOTER_SHELL_CLASS =
  "bg-gradient-to-br from-[#111418] via-[#1A2430] to-[#0E1116] text-white relative overflow-hidden rounded-t-2xl sm:rounded-t-[36px] mx-2 sm:mx-0";

type FooterProps = {
  /** Dans FinalCTA : pas de fond propre, la section parente fournit déjà le dégradé. */
  embedded?: boolean;
  className?: string;
};

type FooterLink = {
  label: string;
  href: string;
  external?: boolean;
};

const FOOTER_COLUMNS: { title: string; links: FooterLink[] }[] = [
  {
    title: "Fonctionnalités",
    links: [
      { label: "Scoring prédictif", href: "/fonctionnalites/scoring" },
      { label: "Module SCI", href: "/fonctionnalites/sci" },
      { label: "Liste hebdomadaire", href: "/fonctionnalites/livraison" },
    ],
  },
  {
    title: "Ressources",
    links: [
      { label: "Blog", href: "/blog" },
      { label: "À propos", href: "/a-propos" },
    ],
  },
  {
    title: "Légal",
    links: [
      { label: "Mentions légales", href: "/mentions-legales" },
      { label: "Confidentialité", href: "/politique-de-confidentialite" },
      { label: "CGU", href: "/cgu" },
      { label: "Contact", href: "mailto:hello@priimo.fr", external: true },
    ],
  },
];

function FooterPattern() {
  return (
    <div
      className="absolute inset-0 opacity-[0.04] pointer-events-none"
      style={{
        backgroundImage:
          "radial-gradient(circle at 20% 30%, white 1.5px, transparent 1.5px), radial-gradient(circle at 80% 70%, white 1.5px, transparent 1.5px)",
        backgroundSize: "48px 48px",
      }}
      aria-hidden
    />
  );
}

function FooterColumn({ title, links }: { title: string; links: FooterLink[] }) {
  const linkClass =
    "inline-block text-[15px] font-medium text-white/85 transition-colors duration-200 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/50";

  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase text-white/70 [letter-spacing:0.08em]">{title}</p>
      <ul className="mt-3.5 space-y-3">
        {links.map((link) => (
          <li key={link.href}>
            {link.external ? (
              <a href={link.href} className={linkClass}>
                {link.label}
              </a>
            ) : (
              <Link href={link.href} className={linkClass}>
                {link.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function FooterContent() {
  return (
    <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-8 pt-16 sm:pt-20 pb-10 min-w-0">
      <div className="flex flex-col gap-10 lg:grid lg:grid-cols-4 lg:gap-10">
        <div className="min-w-0">
          <Link href="/" className="font-sans text-2xl font-bold tracking-tight text-white">
            Priimo
          </Link>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-white/60">
            Prospection immobilière prédictive, sur données publiques.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:col-span-3">
          {FOOTER_COLUMNS.map((column) => (
            <FooterColumn key={column.title} title={column.title} links={column.links} />
          ))}
        </div>
      </div>

      <div className="mt-10 border-t border-white/15 pt-6 text-xs text-white/50">
        © 2026 Priimo · Fait en France
      </div>
    </div>
  );
}

export default function Footer({ embedded = false, className = "" }: FooterProps) {
  if (embedded) {
    return <FooterContent />;
  }

  return (
    <footer className={[FOOTER_SHELL_CLASS, className].filter(Boolean).join(" ")}>
      <FooterPattern />
      <FooterLandscapeBg />
      <FooterContent />
    </footer>
  );
}
