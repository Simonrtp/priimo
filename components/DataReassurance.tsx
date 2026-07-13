import Reveal from "./Reveal";
import { ICONS, ICON_SIZE } from "@/lib/iconMapping";

// === DATA REASSURANCE (Section G) ===
// Bandeau pleine largeur, plus sombre que le footer — pastilles verre.

const ACCENT = "#E8743C";

const POINTS = [
  {
    label: "Hébergées en France",
    Icon: ICONS.mapPin,
  },
  {
    label: "Jamais revendues à des tiers",
    Icon: ICONS.shieldCheck,
  },
  {
    label: "Sans engagement, résiliable à tout moment",
    Icon: ICONS.mail,
  },
];

export default function DataReassurance() {
  return (
    <section className="relative mx-2 w-auto overflow-hidden rounded-[28px] bg-gradient-to-br from-[#060809] via-[#0A0E12] to-[#030405] py-16 text-white sm:mx-0 sm:rounded-[40px] sm:py-24">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 30%, white 1.5px, transparent 1.5px), radial-gradient(circle at 80% 70%, white 1.5px, transparent 1.5px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-[280px] w-[420px] max-w-[80%] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-20 blur-[100px]"
        style={{ background: "radial-gradient(circle, #E8743C 0%, transparent 70%)" }}
      />

      <div className="relative z-10 mx-auto min-w-0 max-w-6xl px-4 sm:px-8">
        <Reveal direction="up">
          <div className="flex justify-center">
            <span className="kicker kicker--light mb-5">
              <span className="kicker__dot" />
              Sécurité des données
            </span>
          </div>
          <h2 className="text-h2-on-dark text-balance px-1 text-center">
            Vos données sont en sécurité.
          </h2>

          <ul className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-5 lg:mt-10">
            {POINTS.map((p, i) => {
              const ItemIcon = p.Icon;
              return (
                <Reveal key={p.label} direction="scale" delay={i * 90} as="li">
                  <div className="flex h-full flex-col items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-5 py-7 text-center">
                    <span
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent/12"
                      aria-hidden
                    >
                      <ItemIcon size={ICON_SIZE.lg} color={ACCENT} strokeWidth={2} />
                    </span>
                    <span className="text-sm font-semibold text-white/85">{p.label}</span>
                  </div>
                </Reveal>
              );
            })}
          </ul>

          <div
            aria-hidden
            className="mx-auto mt-8 h-px max-w-md bg-gradient-to-r from-transparent via-white/10 to-transparent lg:mt-10"
          />

          <Reveal direction="fade" delay={250}>
            <p className="text-body mx-auto mt-6 max-w-2xl text-pretty text-center text-white/60 lg:mt-8">
              Priimo croise des bases de données françaises — DVF, DPE ADEME, BODACC,
              registre des copropriétés, données privées — pour relier signaux marché et
              événements de vie sur chaque bien. Les mêmes sources que les leaders du marché ; le
              travail de lecture et de scoring en plus.
            </p>
          </Reveal>
        </Reveal>
      </div>
    </section>
  );
}
