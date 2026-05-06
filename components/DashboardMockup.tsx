// === DASHBOARD MOCKUP ===
// Stylised, static placeholder for the product visual in the hero.
// Dark surface, list of fictional prospects with score badges + signal tags.
// The 3D tilt is applied via the `.tilt` class (see globals.css).

type Prospect = {
  address: string;
  city: string;
  score: number;
  signals: string[];
};

const PROSPECTS: Prospect[] = [
  {
    address: "12 rue des Tilleuls",
    city: "Bordeaux 33000",
    score: 94,
    signals: ["DPE refait", "Détenu 11 ans"],
  },
  {
    address: "8 avenue Pasteur",
    city: "Bordeaux 33200",
    score: 89,
    signals: ["Succession", "Zone +12% rotation"],
  },
  {
    address: "27 cours Victor Hugo",
    city: "Bordeaux 33000",
    score: 86,
    signals: ["DPE F", "Détenu 14 ans"],
  },
  {
    address: "3 place Gambetta",
    city: "Bordeaux 33000",
    score: 81,
    signals: ["Travaux récents"],
  },
  {
    address: "45 rue Sainte-Catherine",
    city: "Bordeaux 33000",
    score: 78,
    signals: ["Locataire parti"],
  },
];

function scoreColor(score: number) {
  // Hot scores in orange (brand "alert"), mid-tier in slate blue (cool/neutral)
  if (score >= 90) return "bg-orange-500/20 text-orange-200 border-orange-400/35";
  if (score >= 85) return "bg-[rgba(123,154,192,0.20)] text-[#B8CDE3] border-[rgba(123,154,192,0.35)]";
  return "bg-[rgba(123,154,192,0.14)] text-[#B8CDE3]/90 border-[rgba(123,154,192,0.25)]";
}

export default function DashboardMockup() {
  return (
    <div className="tilt relative">
      {/* Aura — warm orange + cool blue glow for balance */}
      <div className="absolute -inset-4 rounded-[28px] bg-accent/25 blur-2xl opacity-50" aria-hidden />
      <div className="absolute -inset-6 rounded-[28px] bg-blue/20 blur-3xl opacity-40 -z-10" aria-hidden />

      {/* Surface: warm-blue dark — sits between #1A1612 (warm) and #15202F (cool) */}
      <div className="relative rounded-2xl bg-soft-inkBlue text-white shadow-2xl ring-1 ring-white/10 overflow-hidden">
        {/* Window chrome */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          <div className="ml-3 text-[11px] text-white/50 tracking-wide">
            priimo.app · Tableau de bord
          </div>
        </div>

        {/* Header bar */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-white/40">
              Liste de la semaine
            </div>
            <div className="font-display text-lg leading-tight mt-0.5">
              Bordeaux Centre · 47 prospects
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wider text-white/40">
              Couverture
            </div>
            <div className="font-display text-lg leading-tight mt-0.5 text-accent-light font-bold">
              68%
            </div>
          </div>
        </div>

        {/* Prospect list */}
        <ul className="divide-y divide-white/5">
          {PROSPECTS.map((p) => (
            <li key={p.address} className="flex items-center gap-3 px-5 py-3.5">
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
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </li>
          ))}
        </ul>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/5 flex items-center justify-between text-[11px] text-white/45">
          <span>Mis à jour il y a 2 min</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-light animate-pulse" />
            Données DVF · DPE · ADEME
          </span>
        </div>
      </div>
    </div>
  );
}
