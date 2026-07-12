// === RARITY STRIP ===
// Illustre la cadence irrégulière des dissolutions : certaines semaines
// plusieurs, d'autres aucune. Purement illustratif, données fictives.

// Nombre de signaux détectés par semaine (fictif) — sur ~10 semaines.
const WEEKS = [0, 1, 0, 0, 2, 0, 3, 0, 1, 0];

export default function RarityStrip() {
  return (
    <div className="relative w-full max-w-[440px] min-w-0">
      <div
        className="absolute -inset-3 rounded-[28px] bg-accent/12 blur-2xl opacity-60"
        aria-hidden
      />
      <div className="relative rounded-2xl border border-black/[0.06] bg-white p-5 shadow-[0_10px_40px_-14px_rgba(17,24,39,0.18)] sm:p-6">
        <div className="flex items-baseline justify-between">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.09em] text-gray-400">
            Dissolutions détectées
          </p>
          <span className="text-[11px] font-medium text-gray-400">
            par semaine
          </span>
        </div>

        <div className="mt-5 flex items-end justify-between gap-1.5">
          {WEEKS.map((count, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
              <div className="flex flex-col-reverse items-center gap-1">
                {count === 0 ? (
                  <span
                    className="h-1 w-4 rounded-full bg-gray-200"
                    aria-hidden
                  />
                ) : (
                  Array.from({ length: count }).map((_, d) => (
                    <span
                      key={d}
                      className="h-2.5 w-2.5 rounded-full bg-gradient-to-br from-[#F4A87A] to-[#E8743C]"
                      aria-hidden
                    />
                  ))
                )}
              </div>
              <span className="h-3.5 border-l border-dashed border-gray-200" aria-hidden />
            </div>
          ))}
        </div>

        <p className="mt-4 border-t border-black/[0.05] pt-3 text-[12px] leading-relaxed text-gray-500">
          Un signal rare — livré quand il existe, jamais gonflé pour faire du
          volume.
        </p>
      </div>
    </div>
  );
}
