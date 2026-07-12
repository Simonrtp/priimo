import Reveal from "./Reveal";
import { ICONS, ICON_SIZE } from "@/lib/iconMapping";

// === DATA REASSURANCE (Section G) ===
// Panneau indigo sombre — casse le blanc de la page, cartes blanches en relief.

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
      <div className="mx-auto min-w-0 max-w-6xl px-3 sm:px-6">
        <Reveal direction="up">
          <div
            className="relative overflow-hidden rounded-[28px] px-6 py-10 sm:rounded-[36px] sm:px-10 sm:py-14 lg:px-14 lg:py-16"
            style={{
              background:
                "linear-gradient(135deg, #1e1b75 0%, #312e81 42%, #1a1654 100%)",
              boxShadow:
                "0 40px 100px -24px rgba(49, 46, 129, 0.72), 0 0 0 1px rgba(129, 140, 248, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.12)",
            }}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-[0.06]"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 15% 25%, white 1.5px, transparent 1.5px), radial-gradient(circle at 85% 75%, white 1.5px, transparent 1.5px)",
                backgroundSize: "40px 40px",
              }}
            />

            <div
              aria-hidden
              className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-indigo-400/35 blur-[90px]"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-violet-500/30 blur-[100px]"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-0 h-48 w-[min(560px,90%)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-300/20 blur-[70px]"
            />

            <div className="relative">
              <div className="flex justify-center">
                <span className="kicker mb-5 text-indigo-200">
                  <span className="kicker__dot !bg-indigo-300" />
                  Sécurité des données
                </span>
              </div>
              <h2 className="text-h2 text-balance px-1 text-center text-white">
                Vos données sont en sécurité.
              </h2>

              <ul className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-5 lg:mt-10">
                {POINTS.map((p, i) => {
                  const ItemIcon = p.Icon;
                  return (
                    <Reveal key={p.label} direction="scale" delay={i * 90} as="li">
                      <div className="flex h-full flex-col items-center gap-3 rounded-2xl border border-white/90 bg-white px-5 py-7 text-center shadow-[0_20px_50px_-20px_rgba(15,10,60,0.55),0_8px_24px_-12px_rgba(0,0,0,0.25)]">
                        <span
                          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-500/12"
                          aria-hidden
                        >
                          <ItemIcon size={ICON_SIZE.lg} color={p.color} strokeWidth={2} />
                        </span>
                        <span className="text-sm font-semibold text-gray-900">{p.label}</span>
                      </div>
                    </Reveal>
                  );
                })}
              </ul>

              <div
                aria-hidden
                className="mx-auto mt-8 h-px max-w-md bg-gradient-to-r from-transparent via-indigo-300/40 to-transparent lg:mt-10"
              />

              <Reveal direction="fade" delay={250}>
                <p className="text-body mx-auto mt-6 max-w-2xl text-pretty text-center text-indigo-100/90 lg:mt-8">
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
