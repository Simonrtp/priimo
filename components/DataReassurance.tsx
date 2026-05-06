import Reveal from "./Reveal";

// === DATA REASSURANCE (Section G) ===
// Discrete H2, three reassurance points, source credit footnote.

const POINTS = [
  { icon: "🇫🇷", label: "Données hébergées en France" },
  { icon: "🔐", label: "Aucune donnée revendue à des tiers" },
  { icon: "✉️", label: "Désinscription en un clic à tout moment" },
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
          {POINTS.map((p, i) => (
            <Reveal key={p.label} direction="scale" delay={i * 90} as="li">
              <div className="flex items-center gap-3 rounded-xl bg-white border border-black/10 shadow-soft px-5 py-4 h-full">
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-base leading-none"
                  aria-hidden
                >
                  {p.icon}
                </span>
                <span className="text-sm font-medium text-gray-900">{p.label}</span>
              </div>
            </Reveal>
          ))}
        </ul>

        <Reveal direction="fade" delay={250}>
          <p className="mt-6 text-body text-center max-w-2xl mx-auto">
            Priimo utilise exclusivement des données publiques françaises (DVF
            data.gouv.fr, DPE ADEME) — les mêmes sources que les leaders du
            marché, sans leurs prix.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
