import Reveal from "./Reveal";
import CtaButton from "./CtaButton";

// === FINAL CTA (Section J) ===
// Full-bleed accent background, white text, single big CTA.

const POINTS = [
  "Les signaux de vente, avant la mise en ligne",
  "15 à 30 adresses priorisées par mois",
  "Secteur exclusif — premier arrivé, premier servi",
];

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export default function FinalCTA() {
  return (
    <section className="bg-gradient-to-br from-[#111418] via-[#1A2430] to-[#0E1116] text-white relative overflow-hidden">
      {/* Subtle decorative pattern */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 30%, white 1.5px, transparent 1.5px), radial-gradient(circle at 80% 70%, white 1.5px, transparent 1.5px)",
          backgroundSize: "48px 48px",
        }}
        aria-hidden
      />

      <div className="relative mx-auto max-w-4xl px-4 sm:px-8 pt-16 sm:pt-28 text-center min-w-0">
        <Reveal direction="up">
          <h2 className="text-h1-on-dark text-balance px-1 mb-headline">
            Sur votre secteur, il n&apos;y aura qu&apos;une seule agence équipée.
          </h2>
        </Reveal>

        <Reveal direction="up" delay={120}>
          <ul className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 text-white/90">
            {POINTS.map((p) => (
              <li key={p} className="flex items-center gap-2 text-body !text-white/90">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/15 text-white">
                  <CheckIcon />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal direction="scale" delay={250} className="mt-10">
          <CtaButton variant="invert" size="lg">
            Réserver une démo
            <span aria-hidden>→</span>
          </CtaButton>
          <p className="mt-4 small-text !normal-case !tracking-normal text-white/70">
            20 minutes · Sans engagement · Disponibilité du secteur vérifiée en direct
          </p>
        </Reveal>
      </div>

      {/* Footer content merged into the same section for one continuous block */}
      <div className="relative mx-auto max-w-6xl px-4 sm:px-8 pt-16 sm:pt-20 pb-10 min-w-0">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 text-gray-400">
          <a href="/" className="font-sans text-2xl font-bold tracking-tight text-white">
            Priimo
          </a>

          <nav aria-label="Liens utiles">
            <ul className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <li>
                <a href="#" className="hover:text-white transition">Mentions légales</a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition">Politique de confidentialité</a>
              </li>
              <li>
                <a href="mailto:hello@priimo.fr" className="hover:text-white transition">Contact</a>
              </li>
            </ul>
          </nav>
        </div>

        <div className="mt-7 text-xs text-gray-500">
          © 2026 Priimo · Fait en France
        </div>
      </div>
    </section>
  );
}
