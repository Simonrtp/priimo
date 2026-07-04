// === DASHBOARD MOCKUP ===
// Visuel produit du hero. Refonte 2.0 : surface sombre chaude/bleutée, chrome
// vitré, badges de score en dégradé, balayage lumineux (sheen), badge de score
// flottant. Contenu (prospects, signaux) inchangé — placeholder fictif.

type Prospect = {
  address: string;
  city: string;
  score: number;
  signals: string[];
};

const PROSPECTS: Prospect[] = [
  {
    address: "14 rue de la Folie-Méricourt",
    city: "Paris 11e",
    score: 94,
    signals: ["DPE refait · 3 sem.", "3 ventes immeuble"],
  },
  {
    address: "8 rue Saint-Maur",
    city: "Paris 11e",
    score: 91,
    signals: ["Événement de vie", "Détenu 20+ ans"],
  },
  {
    address: "27 rue de Charonne",
    city: "Paris 11e",
    score: 88,
    signals: ["DPE G · loi Climat", "Location interdite"],
  },
  {
    address: "3 passage Beslay",
    city: "Paris 11e",
    score: 84,
    signals: ["Copro sans syndic", "DPE récent"],
  },
  {
    address: "45 boulevard Voltaire",
    city: "Paris 11e",
    score: 90,
    signals: ["Dissolution SCI", "Dirigeant identifié"],
  },
];

function scoreColor(score: number) {
  // Heat duotone : scores chauds (≥90) en orange, intermédiaires en indigo (cool).
  if (score >= 90)
    return "bg-gradient-to-br from-orange-400/25 to-orange-500/10 text-orange-100 border-orange-400/40";
  if (score >= 85)
    return "bg-indigo-500/20 text-indigo-200 border-indigo-400/40";
  return "bg-indigo-500/12 text-indigo-200/90 border-indigo-400/25";
}

export default function DashboardMockup() {
  return (
    <div className="tilt relative w-full max-w-full min-w-0">
      {/* Aura — warm orange + cool blue glow */}
      <div
        className="absolute -inset-3 sm:-inset-6 rounded-[32px] bg-accent/25 blur-3xl opacity-50"
        aria-hidden
      />
      <div
        className="absolute -inset-4 sm:-inset-8 rounded-[32px] bg-indigo-500/20 blur-3xl opacity-40 -z-10"
        aria-hidden
      />

      {/* Badge de score flottant (valeur issue des données) */}
      <div
        className="float-chip absolute -left-4 top-10 z-20 hidden sm:flex items-center gap-2.5 rounded-2xl border border-white/70 bg-white/80 px-3.5 py-2.5 shadow-[0_16px_34px_-18px_rgba(60,40,20,0.5)] backdrop-blur-md"
        aria-hidden
      >
        <span
          className="flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold text-white"
          style={{ background: "linear-gradient(135deg,#f6ad63,#e8743c)" }}
        >
          94
        </span>
        <div className="leading-tight">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
            Score max
          </div>
          <div className="text-[13px] font-semibold text-gray-900">Priorité haute</div>
        </div>
      </div>

      {/* Surface: warm-blue dark — sits between #1A1612 (warm) and #15202F (cool) */}
      <div className="sheen relative rounded-[22px] bg-soft-inkBlue text-white shadow-2xl ring-1 ring-white/10 overflow-hidden">
        {/* Window chrome */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#FF6159]/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#FFBD2E]/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28C840]/70" />
          <div className="ml-2 sm:ml-3 min-w-0 text-[10px] sm:text-[11px] text-white/50 tracking-wide truncate">
            priimo.app · Tableau de bord
          </div>
        </div>

        {/* Header bar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-4 sm:px-5 py-3.5 sm:py-4 border-b border-white/5">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wider text-white/40">
              Liste de la semaine
            </div>
            <div className="font-display text-base sm:text-lg leading-tight mt-0.5 break-words">
              Paris 11e · 22 prospects
            </div>
          </div>
          <div className="text-left sm:text-right shrink-0">
            <div className="text-[11px] uppercase tracking-wider text-white/40">
              Score moyen
            </div>
            <div className="font-display text-lg leading-tight mt-0.5 text-accent-light font-bold">
              86
            </div>
          </div>
        </div>

        {/* Prospect list */}
        <ul className="divide-y divide-white/5">
          {PROSPECTS.map((p) => (
            <li
              key={p.address}
              className="flex items-center gap-3 px-5 py-3.5 transition-colors duration-300 hover:bg-white/[0.03]"
            >
              <div
                className={`shrink-0 w-11 h-11 rounded-xl border flex items-center justify-center font-display font-semibold text-sm ${scoreColor(
                  p.score
                )}`}
              >
                {p.score}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{p.address}</div>
                <div className="text-[11px] text-white/45 truncate">{p.city}</div>
              </div>
              <div className="hidden sm:flex flex-wrap gap-1.5 max-w-[180px] justify-end">
                {p.signals.map((s) => (
                  <span
                    key={s}
                    className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-white/5 text-white/60 border border-white/5"
                  >
                    {s}
                  </span>
                ))}
              </div>
              <button
                type="button"
                tabIndex={-1}
                aria-hidden
                className="ml-1 text-white/30 hover:text-white/60 transition shrink-0"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </li>
          ))}
        </ul>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/5 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between text-[11px] text-white/45">
          <span className="shrink-0">Mis à jour lundi</span>
          <span className="inline-flex flex-wrap items-center gap-1.5 min-w-0">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent-light animate-pulse" />
            <span className="break-words">DVF · DPE ADEME · BODACC</span>
          </span>
        </div>
      </div>
    </div>
  );
}
