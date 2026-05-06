import Reveal from "./Reveal";
import CtaButton from "./CtaButton";

// === FINAL CTA (Section J) ===
// Full-bleed accent background, white text, single big CTA.

const POINTS = [
  "Identifiez les vendeurs 6 mois à l'avance",
  "Guidez vos agents vers les bonnes portes",
  "Opérationnel en 20 minutes",
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
          <h2 className="font-display text-2xl sm:text-3xl md:text-4xl lg:text-5xl leading-tight font-extrabold text-balance px-1">
            Vos concurrents prospectent déjà avec de la data. Et vous&nbsp;?
          </h2>
        </Reveal>

        <Reveal direction="up" delay={120}>
          <ul className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 text-white/90">
            {POINTS.map((p) => (
              <li key={p} className="flex items-center gap-2 text-[15px]">
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
            Je rejoins la bêta privée
            <span aria-hidden>→</span>
          </CtaButton>
          <p className="mt-4 text-[13px] text-white/70">
            Gratuit pendant la bêta · Aucune CB · 47 agences déjà inscrites
          </p>
        </Reveal>
      </div>

      {/* Footer content merged into the same section for one continuous block */}
      <div className="relative mx-auto max-w-6xl px-4 sm:px-8 pt-16 sm:pt-20 pb-10 min-w-0">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 text-gray-400">
          <a href="#top" className="font-display text-2xl font-bold tracking-tight text-white">
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
          © 2025 Priimo · Fait en France 🇫🇷
        </div>
      </div>
    </section>
  );
}
