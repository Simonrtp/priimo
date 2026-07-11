import Reveal from "./Reveal";
import { ICONS, ICON_SIZE } from "@/lib/iconMapping";

// === DATA REASSURANCE (Section G) ===
// Refonte 2.0 : section « confiance » en indigo (accent cool = sécurité/données).
// Panneau verre, trois points en pastilles, note de source en pied. Textes inchangés.

const INDIGO = "#6366F1";

const POINTS = [
  {
    label: "Hébergées en France",
    Icon: ICONS.mapPin,
    color: INDIGO,
  },
  {
    label: "Jamais revendues à des tiers",
    Icon: ICONS.shieldCheck,
    color: INDIGO,
  },
  {
    label: "Sans engagement, résiliable à tout moment",
    Icon: ICONS.mail,
    color: INDIGO,
  },
];

export default function DataReassurance() {
  return (
    <section className="py-14 sm:py-20">
      <div className="mx-auto max-w-5xl px-4 sm:px-8 min-w-0">
        <Reveal direction="up">
          <div className="glass cool-panel relative overflow-hidden rounded-[28px] p-8 sm:p-12">
            {/* Lueur d'angle discrète */}
            <div
              aria-hidden
              className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-indigo-500/12 blur-3xl"
            />

            <div className="relative">
              <div className="flex justify-center">
                <span className="kicker kicker--indigo mb-5">
                  <span className="kicker__dot" />
                  Sécurité des données
                </span>
              </div>
              <h2 className="text-h2 text-center text-gray-900 text-balance px-1">
                Vos données sont en sécurité.
              </h2>

              <ul className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-5">
                {POINTS.map((p, i) => {
                  const ItemIcon = p.Icon;
                  return (
                    <Reveal key={p.label} direction="scale" delay={i * 90} as="li">
                      <div className="flex h-full flex-col items-center gap-3 rounded-2xl border border-white/70 bg-white/70 px-5 py-6 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_16px_32px_-24px_rgba(49,46,129,0.35)]">
                        <span
                          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-500/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]"
                          aria-hidden
                        >
                          <ItemIcon size={ICON_SIZE.lg} color={p.color} strokeWidth={2} />
                        </span>
                        <span className="text-sm font-semibold text-gray-900">
                          {p.label}
                        </span>
                      </div>
                    </Reveal>
                  );
                })}
              </ul>

              <div
                aria-hidden
                className="mx-auto mt-8 h-px max-w-sm bg-gradient-to-r from-transparent via-black/10 to-transparent"
              />

              <Reveal direction="fade" delay={250}>
                <p className="mt-6 text-body text-center max-w-2xl mx-auto">
                  Priimo s&apos;appuie exclusivement sur des bases publiques françaises — DVF, DPE
                  ADEME, BODACC, registre des copropriétés — pour croiser signaux marché et
                  événements de vie sur chaque bien. Les mêmes données que les leaders du marché ; le
                  travail de lecture et de scoring en plus.
                </p>
              </Reveal>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
