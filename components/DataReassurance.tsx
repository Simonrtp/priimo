import Reveal from "./Reveal";
import { ICONS, ICON_COLORS, ICON_SIZE } from "@/lib/iconMapping";

// === DATA REASSURANCE (Section G) ===
// Discrete H2, three reassurance points, source credit footnote.

const POINTS = [
  {
    label: "Hébergées en France",
    Icon: ICONS.mapPin,
    color: ICON_COLORS.neutral,
  },
  {
    label: "Jamais revendues à des tiers",
    Icon: ICONS.shieldCheck,
    color: ICON_COLORS.neutral,
  },
  {
    label: "Sans engagement, résiliable à tout moment",
    Icon: ICONS.mail,
    color: ICON_COLORS.neutral,
  },
];

export default function DataReassurance() {
  return (
    <section className="py-14 sm:py-20">
      <div className="mx-auto max-w-5xl px-4 sm:px-8 min-w-0">
        <Reveal direction="up">
          <h2 className="text-h2 text-center text-gray-900 text-balance px-1 mb-subheading">
            Vos données sont en sécurité.
          </h2>
        </Reveal>

        <ul className="mt-8 grid sm:grid-cols-3 gap-4 sm:gap-6">
          {POINTS.map((p, i) => {
            const ItemIcon = p.Icon;
            return (
              <Reveal key={p.label} direction="scale" delay={i * 90} as="li">
                <div className="flex items-center gap-3 rounded-xl bg-white border border-black/10 shadow-soft px-5 py-4 h-full">
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10"
                    aria-hidden
                  >
                    <ItemIcon size={ICON_SIZE.sm} color={p.color} strokeWidth={2} />
                  </span>
                  <span className="text-sm font-medium text-gray-900">{p.label}</span>
                </div>
              </Reveal>
            );
          })}
        </ul>

        <Reveal direction="fade" delay={250}>
          <p className="mt-6 text-body text-center max-w-2xl mx-auto">
            Priimo s&apos;appuie exclusivement sur des bases publiques françaises — DVF, DPE
            ADEME, BODACC, registre des copropriétés — pour croiser signaux marché et
            événements de vie sur chaque bien. Les mêmes données que les leaders du marché ; le
            travail de lecture et de scoring en plus.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
