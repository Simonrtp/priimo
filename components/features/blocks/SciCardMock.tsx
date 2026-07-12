import { Building2, ScrollText, User, Phone, Mail } from 'lucide-react';
import ScoreRing from '@/components/dashboard/ScoreRing';

// === SCI CARD MOCK ===
// Carte de lead « entreprise » — variante SCI. Purement visuelle, données 100 %
// fictives. Contrairement au particulier, la société expose un dirigeant et un
// contact professionnel (registres légaux publics).

export default function SciCardMock() {
  return (
    <div className="tilt relative w-full max-w-[420px] min-w-0">
      <div
        className="absolute -inset-4 rounded-[32px] bg-accent/15 blur-3xl opacity-60"
        aria-hidden
      />
      <div
        className="absolute -inset-6 rounded-[32px] bg-blue/10 blur-3xl opacity-40 -z-10"
        aria-hidden
      />

      <div className="relative overflow-hidden rounded-[20px] border border-black/[0.06] bg-white shadow-[0_24px_60px_-20px_rgba(17,24,39,0.28)]">
        {/* En-tête : score + société */}
        <div className="flex items-start gap-3.5 px-5 pt-5">
          <ScoreRing score={90} size={52} />
          <div className="min-w-0 flex-1">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-black/[0.05] px-2 py-0.5 text-[10.5px] font-medium text-gray-500">
              <Building2 size={11} strokeWidth={2.2} aria-hidden />
              Société
            </span>
            <p className="mt-1.5 text-[15px] font-semibold leading-snug tracking-[-0.01em] text-gray-900">
              SCI des Trois Cyprès
            </p>
            <p className="text-[12.5px] text-gray-500">SCI · 3 lots · Paris 11e</p>
          </div>
        </div>

        {/* Événement BODACC */}
        <div className="mt-4 px-5">
          <div className="flex items-start gap-2.5 rounded-xl border border-[#F3D9C7] bg-[#FFF6EF] px-3 py-2.5">
            <span className="mt-px flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#FCE4D4] text-[#C2410C]">
              <ScrollText size={15} strokeWidth={2.1} aria-hidden />
            </span>
            <p className="min-w-0 text-[13px] leading-snug text-gray-700">
              <span className="font-semibold text-gray-900">
                Dissolution publiée au BODACC
              </span>
              <span className="text-gray-400"> — </span>
              annonce du 3 juillet
            </p>
          </div>
        </div>

        {/* Dirigeant + contact pro */}
        <div className="mt-4 space-y-2.5 border-t border-black/[0.05] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
              <User size={15} strokeWidth={2} aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-[10.5px] uppercase tracking-[0.06em] text-gray-400">
                Gérant
              </p>
              <p className="text-[13px] font-medium text-gray-800">M. A. Renard</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pl-[38px] text-[12.5px] text-gray-600">
            <span className="inline-flex items-center gap-1.5">
              <Phone size={13} strokeWidth={2} className="text-[#C25E2C]" aria-hidden />
              01 84 •• •• ••
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Mail size={13} strokeWidth={2} className="text-[#C25E2C]" aria-hidden />
              gerance@•••••.fr
            </span>
          </div>
        </div>

        {/* Pied : sources */}
        <div className="flex items-center justify-between gap-2 border-t border-black/[0.05] px-5 py-3 text-[11px] text-gray-400">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-light" aria-hidden />
            BODACC · INPI · Infogreffe
          </span>
          <span className="opacity-70">Données fictives</span>
        </div>
      </div>
    </div>
  );
}
