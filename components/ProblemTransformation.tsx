import Image from "next/image";
import Reveal from "./Reveal";
import CtaButton from "./CtaButton";

// === PROBLEM / TRANSFORMATION (Section C) ===
// Refonte 2.0 : panneau sombre chaud/bleuté, deux cartes « avant / avec »
// en verre sombre, connecteur de transformation au centre (desktop),
// numérotation fantôme et hairlines dégradés. Textes inchangés.

type Item = { title: string; description: string };

const BEFORE: Item[] = [
  {
    title: "Du porte-à-porte à l'aveugle",
    description:
      "Porte-à-porte, des milliers de flyers distribués : vos agents passent des journées à frapper dans le vent, sans savoir quelle porte cache un projet de vente.",
  },
  {
    title: "Des leads déjà grillés",
    description:
      "Quand un bien apparaît sur les portails, le vendeur a déjà reçu cinq appels — et souvent choisi son agence.",
  },
  {
    title: "Aucune mémoire de prospection",
    description:
      "Qui a frappé où, quand, avec quel résultat : tout est dans des carnets, rien n'est partagé.",
  },
];

const AFTER: Item[] = [
  {
    title: "Une liste prête chaque lundi",
    description:
      "Chaque semaine, les adresses prioritaires de votre secteur, scorées et expliquées : votre équipe sait où aller et pourquoi.",
  },
  {
    title: "Avant la mise en ligne",
    description:
      "Un DPE refait, un bien détenu vingt ans sans travaux, une cascade de ventes dans l'immeuble : autant d'événements de vie que Priimo repère sur le bien — avant qu'une annonce n'apparaisse.",
  },
  {
    title: "Une prospection qui laisse des traces",
    description:
      "Statuts, notes, résultats : chaque adresse travaillée enrichit votre historique et affine le scoring de votre secteur.",
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

  const tones = isBefore
    ? {
        glow: "rgba(255, 255, 255, 0.06)",
        chipBg: "bg-white/10",
        chipText: "text-white/80",
        ghost: "text-white/[0.05]",
        marker: "bg-white/10 text-white/80",
        desc: "text-white/75",
        Icon: CrossIcon,
      }
    : {
        glow: "rgba(232, 116, 60, 0.12)",
        chipBg: "bg-accent/15",
        chipText: "text-accent-light",
        ghost: "text-white/[0.06]",
        marker: "bg-accent/15 text-accent-light",
        desc: "text-white/80",
        Icon: CheckIcon,
      };

  return (
    <div className="group relative isolate h-full overflow-hidden rounded-[26px] shadow-[0_20px_50px_-28px_rgba(0,0,0,0.55)] transition-all duration-500 hover:-translate-y-1.5 hover:shadow-[0_24px_60px_-24px_rgba(0,0,0,0.65)]">
      {/* Glass léger */}
      <div
        aria-hidden
        className="absolute inset-0 rounded-[26px] bg-white/[0.07] backdrop-blur-md backdrop-saturate-125"
      />
      <div
        aria-hidden
        className={`absolute inset-0 rounded-[26px] ${
          isBefore
            ? "bg-gradient-to-b from-white/[0.08] to-white/[0.02]"
            : "bg-gradient-to-b from-white/[0.09] via-accent/[0.04] to-white/[0.02]"
        }`}
      />

      {/* Soft directional glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -left-24 h-64 w-64 rounded-full blur-3xl opacity-50 transition-opacity duration-500 group-hover:opacity-75"
        style={{ background: tones.glow }}
      />

      {/* Decorative ghost mark in corner */}
      <span
        aria-hidden
        className={`pointer-events-none absolute -right-3 -top-4 z-[1] select-none font-display text-[120px] leading-none font-bold ${tones.ghost}`}
      >
        {isBefore ? "—" : "+"}
      </span>

      <div className="relative z-[2] p-7 sm:p-8">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div
            className={`inline-flex items-center gap-2 rounded-full ${tones.chipBg} px-2.5 py-1`}
          >
            <span className={`flex h-4 w-4 items-center justify-center rounded-full ${tones.chipBg} ${tones.chipText}`}>
              <tones.Icon />
            </span>
            <span className={`text-[10.5px] font-semibold uppercase tracking-[0.18em] ${tones.chipText}`}>
              {label}
            </span>
          </div>
          <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/45">
            {isBefore ? "État actuel" : "Avec Priimo"}
          </span>
        </div>

        {/* Tagline */}
        <p className="mt-5 font-display text-xl sm:text-2xl font-bold text-white leading-snug tracking-tight">
          {tagline}
        </p>

        {/* Items */}
        <ol className="mt-6 space-y-5">
          {items.map((item) => (
            <li
              key={item.title}
              className="grid grid-cols-[auto_1fr] items-start gap-4"
            >
              <div className="pt-0.5">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-lg ${tones.marker}`}
                >
                  <tones.Icon />
                </span>
              </div>
              <div>
                <h4 className="font-sans text-[15px] sm:text-base font-semibold text-white">
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
    <section className="relative overflow-hidden py-14 sm:py-24 mx-2 sm:mx-0 rounded-[28px] sm:rounded-[40px] bg-gradient-to-br from-[#0A0D11] via-[#131A24] to-[#070A0E] text-white">
      {/* Subtle dot pattern */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 30%, white 1.5px, transparent 1.5px), radial-gradient(circle at 80% 70%, white 1.5px, transparent 1.5px)",
          backgroundSize: "48px 48px",
        }}
      />

      {/* Directional glow to keep depth */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-25"
        style={{
          background:
            "radial-gradient(700px 380px at 20% 20%, rgba(99, 102, 241, 0.18), transparent 70%), radial-gradient(700px 380px at 85% 75%, rgba(232, 116, 60, 0.14), transparent 70%)",
        }}
      />

      {/* Haussmann — fond bas, fondu progressif dans le dégradé (sans impact layout) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-[62%] max-h-[580px] overflow-hidden"
        style={{
          maskImage:
            "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.08) 12%, rgba(0,0,0,0.45) 28%, rgba(0,0,0,0.82) 44%, black 58%, black 100%)",
          WebkitMaskImage:
            "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.08) 12%, rgba(0,0,0,0.45) 28%, rgba(0,0,0,0.82) 44%, black 58%, black 100%)",
        }}
      >
        <Image
          src="/haussmann.webp"
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-bottom opacity-90"
          quality={75}
          loading="lazy"
          fetchPriority="low"
        />
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(
              to bottom,
              rgba(19, 26, 36, 0) 0%,
              rgba(19, 26, 36, 0.35) 16%,
              rgba(10, 13, 17, 0.55) 32%,
              rgba(10, 13, 17, 0.38) 48%,
              rgba(7, 10, 14, 0.22) 64%,
              rgba(7, 10, 14, 0.08) 80%,
              transparent 100%
            )`,
          }}
        />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-8 min-w-0">
        <Reveal direction="up">
          <div className="flex justify-center">
            <span className="kicker kicker--light mb-5">
              <span className="kicker__dot" />
              Le constat
            </span>
          </div>
          <h2 className="text-h1-on-dark text-center max-w-3xl mx-auto text-balance px-1">
            La pige est interdite. Les portails arrivent trop tard. Le terrain se fait à
            l&apos;aveugle.
          </h2>
        </Reveal>

        <div className="relative grid md:grid-cols-2 gap-5 lg:gap-7 mt-12">
          {/* Connecteur de transformation (desktop) */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 z-10 hidden md:flex -translate-x-1/2 -translate-y-1/2 h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-[#0E141C] text-accent-light shadow-[0_10px_30px_-8px_rgba(232,116,60,0.5)]"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </div>

          <Reveal direction="left">
            <ComparisonCard
              variant="before"
              label="Avant Priimo"
              tagline="Beaucoup d'efforts, peu de mandats."
              items={BEFORE}
            />
          </Reveal>

          <Reveal direction="right" delay={100}>
            <ComparisonCard
              variant="after"
              label="Avec Priimo"
              tagline="Moins de portes. Plus de mandats."
              items={AFTER}
            />
          </Reveal>
        </div>

        <Reveal direction="scale" delay={200} className="mt-12 flex justify-center">
          <CtaButton>
            Réserver une démo
            <span data-arrow aria-hidden>
              →
            </span>
          </CtaButton>
        </Reveal>
      </div>
    </section>
  );
}
