// === SECTEUR MAP ===
// Illustration SVG légère : un quartier stylisé avec un seul marqueur orange —
// une agence, une zone exclusive. Rien de cartographique réel, fait main.

export default function SecteurMap() {
  return (
    <div className="relative w-full max-w-[460px] min-w-0">
      <div
        className="absolute -inset-3 rounded-[28px] bg-accent/12 blur-2xl opacity-60"
        aria-hidden
      />
      <div className="relative overflow-hidden rounded-2xl border border-black/[0.06] bg-white p-4 shadow-[0_14px_44px_-16px_rgba(17,24,39,0.22)]">
        <div className="mb-3 flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#C25E2C]">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
            Votre secteur
          </span>
          <span className="text-[11px] font-medium text-gray-400">
            1 agence · exclusif
          </span>
        </div>

        <svg
          viewBox="0 0 400 300"
          role="img"
          aria-label="Quartier stylisé avec une seule agence marquée"
          className="w-full rounded-xl bg-[#F7F5F2]"
        >
          {/* Parcelles / pâtés de maisons */}
          <g>
            <rect x="24" y="30" width="88" height="58" rx="8" fill="#ECE9E4" />
            <rect x="140" y="24" width="70" height="46" rx="8" fill="#E7EAEF" />
            <rect x="236" y="34" width="96" height="54" rx="8" fill="#ECE9E4" />
            <rect x="30" y="118" width="80" height="70" rx="8" fill="#E7EAEF" />
            <rect x="286" y="120" width="90" height="64" rx="8" fill="#ECE9E4" />
            <rect x="40" y="214" width="94" height="52" rx="8" fill="#ECE9E4" />
            <rect x="166" y="212" width="76" height="56" rx="8" fill="#E7EAEF" />
            <rect x="272" y="212" width="98" height="56" rx="8" fill="#E7EAEF" />
          </g>

          {/* Rues */}
          <g stroke="#DAD6D0" strokeWidth="7" strokeLinecap="round">
            <line x1="0" y1="103" x2="400" y2="103" />
            <line x1="0" y1="200" x2="400" y2="200" />
            <line x1="126" y1="0" x2="126" y2="300" />
            <line x1="256" y1="0" x2="256" y2="300" />
          </g>

          {/* Zone exclusive autour du marqueur */}
          <circle
            cx="200"
            cy="150"
            r="66"
            fill="#E8743C"
            fillOpacity="0.08"
            stroke="#E8743C"
            strokeOpacity="0.35"
            strokeWidth="1.5"
            strokeDasharray="5 6"
          />

          {/* Marqueur (pin) */}
          <g transform="translate(200 150)">
            <circle r="30" fill="#E8743C" fillOpacity="0.14" />
            <path
              d="M0 -26 C 13 -26 22 -16 22 -3 C 22 11 8 22 0 34 C -8 22 -22 11 -22 -3 C -22 -16 -13 -26 0 -26 Z"
              fill="#E8743C"
            />
            <circle cx="0" cy="-3" r="8" fill="#FFFFFF" />
          </g>
        </svg>
      </div>
    </div>
  );
}
