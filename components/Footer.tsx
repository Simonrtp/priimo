import Link from "next/link";

/** Arrondi en haut uniquement — bas plat, pleine largeur */
export const FOOTER_SHELL_CLASS =
  "bg-gradient-to-br from-[#111418] via-[#1A2430] to-[#0E1116] text-white relative overflow-hidden rounded-t-2xl sm:rounded-t-[36px] mx-2 sm:mx-0";

type FooterProps = {
  /** Dans FinalCTA : pas de fond propre, la section parente fournit déjà le dégradé. */
  embedded?: boolean;
  className?: string;
};

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

function FooterContent() {
  return (
    <div className="relative mx-auto max-w-6xl px-4 sm:px-8 pt-16 sm:pt-20 pb-10 min-w-0">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 text-gray-400">
        <Link href="/" className="font-sans text-2xl font-bold tracking-tight text-white">
          Priimo
        </Link>

        <nav aria-label="Liens utiles">
          <ul className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <li>
              <Link href="/mentions-legales" className="hover:text-white transition">
                Mentions légales
              </Link>
            </li>
            <li>
              <Link href="/politique-de-confidentialite" className="hover:text-white transition">
                Politique de confidentialité
              </Link>
            </li>
            <li>
              <a href="mailto:hello@priimo.fr" className="hover:text-white transition">
                Contact
              </a>
            </li>
          </ul>
        </nav>
      </div>

      <div className="mt-7 text-xs text-gray-500">© 2026 Priimo · Fait en France</div>
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
      <FooterContent />
    </footer>
  );
}
