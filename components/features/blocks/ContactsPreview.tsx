import { Building2, Phone, Store } from 'lucide-react';

// === CONTACTS PREVIEW ===
// Visuel pour la section « numéros » : propriétaire société + voisins immeuble.

export default function ContactsPreview() {
  return (
    <div className="relative w-full max-w-[360px]">
      <div
        className="absolute -inset-3 rounded-[28px] bg-accent/12 blur-2xl opacity-60"
        aria-hidden
      />
      <div className="relative space-y-3">
        <div className="rounded-2xl border border-black/[0.06] bg-white p-4 shadow-[0_10px_40px_-14px_rgba(17,24,39,0.18)] sm:p-5">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FFF0E6] text-[#C25E2C]">
              <Building2 size={15} strokeWidth={2.2} aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-gray-400">
                Propriétaire
              </p>
              <p className="truncate text-[14px] font-semibold text-gray-900">
                SCI Les Lilas
              </p>
            </div>
          </div>
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-[#E8743C]/10 px-3 py-2 text-[13.5px] font-semibold text-[#C25E2C]">
            <Phone size={14} strokeWidth={2.2} aria-hidden />
            01 42 ··· ··· ··
          </p>
          <p className="mt-2 text-[12px] leading-snug text-gray-500">
            Société propriétaire — ligne professionnelle
          </p>
        </div>

        <div className="rounded-2xl border border-black/[0.06] bg-white p-4 shadow-[0_10px_40px_-14px_rgba(17,24,39,0.18)] sm:p-5">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#3D5A80]/10 text-[#3D5A80]">
              <Store size={15} strokeWidth={2.2} aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-gray-400">
                Voisins de l&apos;immeuble
              </p>
              <p className="text-[14px] font-semibold text-gray-900">
                2 contacts pros
              </p>
            </div>
          </div>
          <ul className="mt-3 space-y-2">
            <li className="flex items-center justify-between gap-2 rounded-xl border border-black/[0.05] bg-[#FAFAF9] px-3 py-2">
              <span className="truncate text-[13px] font-medium text-gray-800">
                Boulangerie Martin
              </span>
              <span className="inline-flex shrink-0 items-center gap-1 text-[12.5px] font-medium text-[#3D5A80]">
                <Phone size={12} strokeWidth={2.2} aria-hidden />
                01 48 ···
              </span>
            </li>
            <li className="flex items-center justify-between gap-2 rounded-xl border border-black/[0.05] bg-[#FAFAF9] px-3 py-2">
              <span className="truncate text-[13px] font-medium text-gray-800">
                Cabinet Dupont
              </span>
              <span className="inline-flex shrink-0 items-center gap-1 text-[12.5px] font-medium text-[#3D5A80]">
                <Phone size={12} strokeWidth={2.2} aria-hidden />
                01 53 ···
              </span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
