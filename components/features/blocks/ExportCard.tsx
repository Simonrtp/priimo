import { Download, Map, ChevronRight } from 'lucide-react';

// === EXPORT CARD ===
// Visuel « sur le terrain » : export CSV ou lien Google Maps partagé avec
// l'agent en tournée. Purement illustratif, données fictives.

const ROWS = [
  {
    Icon: Download,
    title: 'Export CSV',
    sub: '12 adresses · secteur Paris 11e',
    action: 'Télécharger',
  },
  {
    Icon: Map,
    title: 'Lien Google Maps',
    sub: 'Partagé avec l’agent en tournée',
    action: 'Partager',
  },
];

export default function ExportCard() {
  return (
    <div className="relative w-full max-w-[440px] min-w-0">
      <div
        className="absolute -inset-3 rounded-[28px] bg-accent/12 blur-2xl opacity-60"
        aria-hidden
      />
      <div className="relative rounded-2xl border border-black/[0.06] bg-white p-5 shadow-[0_10px_40px_-14px_rgba(17,24,39,0.18)] sm:p-6">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.09em] text-gray-400">
          Emporter la liste
        </p>

        <div className="mt-3.5 space-y-2.5">
          {ROWS.map(({ Icon, title, sub, action }) => (
            <div
              key={title}
              className="flex items-center gap-3 rounded-xl border border-black/[0.05] bg-[#FAFAF9] px-3 py-3"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#FFF0E6] text-[#C25E2C]">
                <Icon size={17} strokeWidth={2} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-semibold text-gray-900">{title}</p>
                <p className="truncate text-[12px] text-gray-500">{sub}</p>
              </div>
              <span className="inline-flex items-center gap-0.5 rounded-full bg-white px-2.5 py-1 text-[11.5px] font-semibold text-[#C25E2C] shadow-sm ring-1 ring-black/[0.04]">
                {action}
                <ChevronRight size={13} strokeWidth={2.5} aria-hidden />
              </span>
            </div>
          ))}
        </div>

        <p className="mt-4 border-t border-black/[0.05] pt-3 text-[12px] leading-relaxed text-gray-500">
          Prêt pour la tournée — vos adresses dans sa poche.
        </p>
      </div>
    </div>
  );
}
