import Reveal from "./Reveal";
import CtaButton from "./CtaButton";

// === PROBLEM / TRANSFORMATION (Section C) ===
// Editorial "before / after" panels with refined detailing:
// numbered items, decorative ghost numbers, gradient dividers,
// surface tinted with the column's color and a soft inner glow.

type Item = { title: string; description: string };

const BEFORE: Item[] = [
  {
    title: "Du porte-à-porte à l'aveugle",
    description:
      "Vos agents frappent à des portes au hasard, sans savoir lesquelles sont vraiment chaudes.",
  },
  {
    title: "Toujours en retard sur la concurrence",
    description:
      "Vous perdez des mandats parce que vos concurrents ont déjà appelé avant vous.",
  },
  {
    title: "Aucune visibilité terrain",
    description:
      "Vous ne savez pas ce que fait votre équipe, ni ce qui a déjà été couvert.",
  },
];

const AFTER: Item[] = [
  {
    title: "Une liste prête chaque semaine",
    description:
      "Chaque agent reçoit ses adresses prioritaires, scorées et géolocalisées.",
  },
  {
    title: "6 mois d'avance sur le marché",
    description:
      "Vous identifiez les vendeurs avant qu'ils ne mettent leur bien en ligne.",
  },
  {
    title: "Couverture terrain en temps réel",
    description:
      "Vous voyez instantanément ce qui est traité, par qui, et ce qu'il reste à couvrir.",
  },
];

function CrossIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

type CardProps = {
  variant: "before" | "after";
  label: string;
  tagline: string;
  items: Item[];
};

function ComparisonCard({ variant, label, tagline, items }: CardProps) {
  const isBefore = variant === "before";

  // Color tokens per variant
  const tones = isBefore
    ? {
        ring: "border-blue/25",
        glow: "rgba(123, 154, 192, 0.22)",
        accent: "text-blue-glow",
        chipBg: "bg-blue/15",
        chipBorder: "border-blue/30",
        chipText: "text-blue-glow",
        ghost: "text-white/[0.05]",
        divider: "from-blue/30",
        marker: "bg-blue/15 text-blue-glow border-blue/25",
        title: "text-white",
        desc: "text-white/65",
        Icon: CrossIcon,
      }
    : {
        ring: "border-accent/30",
        glow: "rgba(232, 116, 60, 0.20)",
        accent: "text-accent-light",
        chipBg: "bg-accent/15",
        chipBorder: "border-accent/30",
        chipText: "text-accent-light",
        ghost: "text-white/[0.06]",
        divider: "from-accent/40",
        marker: "bg-accent/15 text-accent-light border-accent/25",
        title: "text-white",
        desc: "text-white/70",
        Icon: CheckIcon,
      };

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border ${tones.ring} bg-gradient-to-b from-white/[0.05] to-white/[0.015] backdrop-blur-sm h-full transition-colors duration-300`}
    >
      {/* Soft directional glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -left-24 h-64 w-64 rounded-full blur-3xl opacity-70"
        style={{ background: tones.glow }}
      />

      {/* Top hairline */}
      <div
        aria-hidden
        className={`absolute top-0 inset-x-6 h-px bg-gradient-to-r ${tones.divider} via-white/10 to-transparent`}
      />

      {/* Decorative ghost number in corner */}
      <span
        aria-hidden
        className={`pointer-events-none select-none absolute -right-3 -top-2 font-sans text-[110px] leading-none font-bold ${tones.ghost}`}
      >
        {isBefore ? "—" : "+"}
      </span>

      <div className="relative p-7 sm:p-8">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div
            className={`inline-flex items-center gap-2 rounded-full border ${tones.chipBorder} ${tones.chipBg} px-2.5 py-1`}
          >
            <span className={`flex h-4 w-4 items-center justify-center rounded-full ${tones.chipBg} ${tones.chipText}`}>
              <tones.Icon />
            </span>
            <span className={`text-[10.5px] font-semibold uppercase tracking-[0.18em] ${tones.chipText}`}>
              {label}
            </span>
          </div>
          <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/30">
            {isBefore ? "État actuel" : "Avec Priimo"}
          </span>
        </div>

        {/* Tagline */}
        <p className="mt-5 font-sans text-xl sm:text-2xl font-semibold text-white leading-snug">
          {tagline}
        </p>

        {/* Divider */}
        <div className={`mt-5 h-px bg-gradient-to-r ${tones.divider} via-white/10 to-transparent`} />

        {/* Items */}
        <ol className="mt-5 space-y-5">
          {items.map((item) => (
            <li
              key={item.title}
              className="grid grid-cols-[auto_1fr] items-start gap-4"
            >
              <div className="pt-0.5">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-lg border ${tones.marker}`}
                >
                  <tones.Icon />
                </span>
              </div>
              <div>
                <h4 className={`font-sans text-[15px] sm:text-base font-semibold ${tones.title}`}>
                  {item.title}
                </h4>
                <p className={`mt-1 text-[14px] leading-relaxed ${tones.desc}`}>
                  {item.description}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

export default function ProblemTransformation() {
  return (
    <section className="relative overflow-hidden py-14 sm:py-24 mx-2 sm:mx-0 rounded-2xl sm:rounded-[36px] bg-gradient-to-br from-[#0A0D11] via-[#131A24] to-[#070A0E] text-white">
      {/* Same subtle dot pattern as the footer block for visual consistency */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 30%, white 1.5px, transparent 1.5px), radial-gradient(circle at 80% 70%, white 1.5px, transparent 1.5px)",
          backgroundSize: "48px 48px",
        }}
      />

      {/* Subtle directional glow to keep depth (matches existing card glows) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-25"
        style={{
          background:
            "radial-gradient(700px 380px at 20% 20%, rgba(123, 154, 192, 0.16), transparent 70%), radial-gradient(700px 380px at 85% 75%, rgba(232, 116, 60, 0.12), transparent 70%)",
        }}
      />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-8 min-w-0">
        <Reveal direction="up">
          <h2 className="text-h1-on-dark text-center max-w-3xl mx-auto text-balance px-1 mb-subheading">
            La pige est morte. Et le porte-à-porte à l&apos;aveugle, c&apos;est du temps perdu.
          </h2>
        </Reveal>

        <div className="grid md:grid-cols-2 gap-5 lg:gap-7 mt-12">
          <Reveal direction="left">
            <ComparisonCard
              variant="before"
              label="Avant Priimo"
              tagline="Beaucoup d'efforts, peu de résultats."
              items={BEFORE}
            />
          </Reveal>

          <Reveal direction="right" delay={100}>
            <ComparisonCard
              variant="after"
              label="Avec Priimo"
              tagline="Moins d'effort, plus de mandats signés."
              items={AFTER}
            />
          </Reveal>
        </div>

        <Reveal direction="scale" delay={200} className="mt-12 flex justify-center">
          <CtaButton>
            Je veux tester Priimo en bêta
            <span aria-hidden>→</span>
          </CtaButton>
        </Reveal>
      </div>
    </section>
  );
}
