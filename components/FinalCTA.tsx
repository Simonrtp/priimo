import Reveal from "./Reveal";
import CtaButton from "./CtaButton";
import Footer from "./Footer";
import FooterLandscapeBg from "./FooterLandscapeBg";

// === FINAL CTA (Section J) ===
// Refonte 2.0 : panneau sombre, grande orbe orange floue, points de preuve en
// pastilles verre, CTA inversé à balayage lumineux. Textes inchangés.

const POINTS = [
  "Événements de vie repérés avant la mise en ligne",
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
    <section className="relative overflow-hidden mx-2 sm:mx-0 rounded-t-[28px] sm:rounded-t-[40px] bg-gradient-to-br from-[#111418] via-[#1A2430] to-[#0E1116] text-white">
      {/* Motif de points discret */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 30%, white 1.5px, transparent 1.5px), radial-gradient(circle at 80% 70%, white 1.5px, transparent 1.5px)",
          backgroundSize: "48px 48px",
        }}
        aria-hidden
      />

      {/* Grande orbe orange floue au centre-haut */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[560px] max-w-[90vw] -translate-x-1/2 -translate-y-1/3 rounded-full opacity-40 blur-[100px]"
        style={{ background: "radial-gradient(circle, #E8743C 0%, transparent 70%)" }}
      />
      {/* Orbe indigo (duotone) en bas-gauche */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 bottom-6 h-[360px] w-[460px] max-w-[85vw] rounded-full opacity-35 blur-[110px]"
        style={{ background: "radial-gradient(circle, #6366F1 0%, transparent 70%)" }}
      />

      <FooterLandscapeBg />

      <div className="relative z-10 mx-auto max-w-4xl px-4 sm:px-8 pt-16 sm:pt-28 text-center min-w-0">
        <Reveal direction="up">
          <div className="flex justify-center">
            <span className="kicker kicker--light mb-6">
              <span className="kicker__dot" />
              Secteur exclusif
            </span>
          </div>
          <h2 className="text-h1-on-dark text-balance px-1 mb-headline">
            Sur votre secteur, il n&apos;y aura qu&apos;une seule agence équipée.
          </h2>
        </Reveal>

        <Reveal direction="up" delay={120}>
          <ul className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:mt-10 lg:flex-row lg:gap-4">
            {POINTS.map((p) => (
              <li
                key={p}
                className="flex min-w-0 items-center justify-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-body !text-white/90 backdrop-blur-sm"
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/25 text-accent-light">
                  <CheckIcon />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal direction="scale" delay={250} className="mt-10">
          <div className="relative inline-block">
            {/* Halo pulsant derrière le CTA */}
            <span
              aria-hidden
              className="pointer-events-none absolute -inset-4 rounded-full bg-accent/25 blur-2xl"
            />
            <CtaButton variant="invert" size="lg" className="relative">
              Réserver une démo
              <span data-arrow aria-hidden>
                →
              </span>
            </CtaButton>
          </div>
          <p className="mt-4 small-text !normal-case !tracking-normal text-white/70">
            20 minutes · Sans engagement · Disponibilité du secteur vérifiée en direct
          </p>
        </Reveal>
      </div>

      <Footer embedded />
    </section>
  );
}
