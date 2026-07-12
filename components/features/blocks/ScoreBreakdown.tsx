// === SCORE BREAKDOWN (bloc D) ===
// Représentation en barres horizontales des composantes du score. Largeurs
// relatives, purement illustratives — aucun point exposé.

type Component = {
  label: string;
  width: number; // largeur relative (%) — illustratif
};

const COMPONENTS: Component[] = [
  { label: 'Récence du diagnostic', width: 94 },
  { label: 'Pression réglementaire', width: 80 },
  { label: 'Activité de l’immeuble', width: 68 },
  { label: 'Durée de détention', width: 55 },
  { label: 'Contexte copropriété', width: 42 },
];

export default function ScoreBreakdown() {
  return (
    <div className="relative w-full max-w-[440px] min-w-0">
      <div
        className="absolute -inset-3 rounded-[28px] bg-accent/12 blur-2xl opacity-60"
        aria-hidden
      />
      <div className="relative rounded-2xl border border-black/[0.06] bg-white p-5 shadow-[0_10px_40px_-14px_rgba(17,24,39,0.20)] sm:p-6">
        <div className="flex items-baseline justify-between">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.09em] text-gray-400">
            Composition du score
          </p>
          <span className="font-sans text-[26px] font-bold leading-none tracking-[-0.02em] text-[#C2410C]">
            91
          </span>
        </div>

        <div className="mt-5 space-y-3.5">
          {COMPONENTS.map(({ label, width }) => (
            <div key={label}>
              <p className="mb-1.5 text-[12.5px] font-medium text-gray-600">
                {label}
              </p>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#F3EEEA]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#F4A87A] to-[#E8743C]"
                  style={{ width: `${width}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        <p className="mt-5 border-t border-black/[0.05] pt-3 text-[12px] leading-relaxed text-gray-500">
          Les meilleures adresses remontent. Le détail reste lisible : chaque
          composante pèse à sa mesure.
        </p>
      </div>
    </div>
  );
}
