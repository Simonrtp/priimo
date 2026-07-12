// === STATUS CHIPS (bloc G) ===
// Le vocabulaire réel du produit. Statuts de travail (Nouveau · Contacté ·
// Intéressé · Pas intéressé) et, à part, les résultats (Mandat signé · Vendeur
// perdu · Pas vendeur · Injoignable). Visuel simple, données fictives.

type Chip = { label: string; dot: string };

const STATUTS: Chip[] = [
  { label: 'Nouveau', dot: '#93B4E0' },
  { label: 'Contacté', dot: '#F5A882' },
  { label: 'Intéressé', dot: '#8FD4A8' },
  { label: 'Pas intéressé', dot: '#B8C0CC' },
];

const RESULTATS: Chip[] = [
  { label: 'Mandat signé', dot: '#047857' },
  { label: 'Vendeur perdu', dot: '#3D5A80' },
  { label: 'Pas vendeur', dot: '#B91C1C' },
  { label: 'Injoignable', dot: '#6B7280' },
];

function Pill({ label, dot }: Chip) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-black/[0.05] px-2.5 py-1 text-[12.5px] font-medium text-gray-700">
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: dot }}
        aria-hidden
      />
      {label}
    </span>
  );
}

function Group({ title, chips }: { title: string; chips: Chip[] }) {
  return (
    <div>
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.09em] text-gray-400">
        {title}
      </p>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {chips.map((c) => (
          <Pill key={c.label} {...c} />
        ))}
      </div>
    </div>
  );
}

type StatusChipsProps = {
  only?: 'statuts' | 'resultats';
};

export default function StatusChips({ only }: StatusChipsProps) {
  return (
    <div className="relative w-full max-w-[440px] min-w-0">
      <div
        className="absolute -inset-3 rounded-[28px] bg-accent/12 blur-2xl opacity-50"
        aria-hidden
      />
      <div className="relative space-y-5 rounded-2xl border border-black/[0.06] bg-white p-5 shadow-[0_10px_40px_-14px_rgba(17,24,39,0.18)] sm:p-6">
        {only !== 'resultats' && (
          <>
            <Group title="Statuts" chips={STATUTS} />

            {/* Mini contexte : assignation + note (fictif) */}
            <div className="flex items-center gap-3 rounded-xl border border-black/[0.05] bg-[#FAFAF9] px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-gray-900">
                  8 rue Saint-Maur
                </p>
                <p className="truncate text-[12px] text-gray-500">
                  Note : « rappeler jeudi »
                </p>
              </div>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#FFF0E6] text-[11px] font-semibold text-[#C25E2C]">
                AB
              </span>
            </div>
          </>
        )}

        {only !== 'statuts' && <Group title="Résultats" chips={RESULTATS} />}
      </div>
    </div>
  );
}
