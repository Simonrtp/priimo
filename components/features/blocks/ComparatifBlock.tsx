import {
  User,
  Building2,
  Lock,
  Phone,
  Mail,
  FileText,
  TrendingUp,
  Check,
} from 'lucide-react';
import Reveal from '@/components/Reveal';

// === COMPARATIF BLOCK ===
// Deux colonnes : la différence légale entre un lead particulier (adresse +
// signaux, jamais de nom) et un lead entreprise (société + dirigeant + contact
// pro). Données fictives, pleine largeur, empilé sur mobile.

function SignalChip({
  Icon,
  label,
}: {
  Icon: typeof FileText;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-black/[0.04] px-2.5 py-1 text-[12px] font-medium text-gray-600">
      <Icon size={12} strokeWidth={2} className="text-gray-400" aria-hidden />
      {label}
    </span>
  );
}

export default function ComparatifBlock() {
  return (
    <Reveal direction="up" className="mt-8">
      <div className="grid grid-cols-1 items-stretch gap-3 md:grid-cols-[1fr_auto_1fr] md:gap-4">
        {/* Lead particulier */}
        <div className="flex flex-col rounded-2xl border border-black/[0.07] bg-white p-5 shadow-[0_1px_2px_rgba(17,24,39,0.04),0_8px_22px_-12px_rgba(17,24,39,0.10)] sm:p-6">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
              <User size={16} strokeWidth={2} aria-hidden />
            </span>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-500">
              Lead particulier
            </p>
          </div>

          <p className="mt-4 text-[15px] font-semibold text-gray-900">
            27 rue de Charonne
          </p>
          <p className="text-[12.5px] text-gray-500">Paris 11e</p>

          <div className="mt-3 flex flex-wrap gap-2">
            <SignalChip Icon={FileText} label="DPE G" />
            <SignalChip Icon={TrendingUp} label="2 ventes immeuble" />
          </div>

          <div className="mt-auto pt-5">
            <div className="flex items-start gap-2.5 rounded-xl bg-[#FAFAF9] px-3 py-2.5">
              <Lock
                size={15}
                strokeWidth={2}
                className="mt-0.5 shrink-0 text-gray-400"
                aria-hidden
              />
              <p className="text-[12.5px] leading-snug text-gray-500">
                <span className="font-semibold text-gray-700">
                  Nom non communiqué
                </span>{' '}
                — donnée personnelle protégée.
              </p>
            </div>
          </div>
        </div>

        {/* Séparateur « vs » */}
        <div className="flex items-center justify-center">
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-black/[0.06] bg-white text-[11px] font-bold uppercase tracking-wide text-gray-400 shadow-sm">
            vs
          </span>
        </div>

        {/* Lead entreprise */}
        <div className="flex flex-col rounded-2xl border border-[#F1C7A8] bg-[#FFFBF7] p-5 shadow-[0_1px_2px_rgba(232,116,60,0.05),0_10px_26px_-12px_rgba(232,116,60,0.22)] sm:p-6">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FFF0E6] text-[#C25E2C]">
              <Building2 size={16} strokeWidth={2} aria-hidden />
            </span>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#C25E2C]">
              Lead entreprise
            </p>
          </div>

          <p className="mt-4 text-[15px] font-semibold text-gray-900">
            SCI des Trois Cyprès
          </p>
          <p className="text-[12.5px] text-gray-500">Gérant : M. A. Renard</p>

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[12.5px] text-gray-700">
            <span className="inline-flex items-center gap-1.5">
              <Phone size={13} strokeWidth={2} className="text-[#C25E2C]" aria-hidden />
              01 84 •• •• ••
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Mail size={13} strokeWidth={2} className="text-[#C25E2C]" aria-hidden />
              gerance@•••••.fr
            </span>
          </div>

          <div className="mt-auto pt-5">
            <div className="flex items-start gap-2.5 rounded-xl bg-[#FFF3EA] px-3 py-2.5">
              <Check
                size={15}
                strokeWidth={2.5}
                className="mt-0.5 shrink-0 text-[#047857]"
                aria-hidden
              />
              <p className="text-[12.5px] leading-snug text-gray-600">
                <span className="font-semibold text-gray-800">Contact direct</span>{' '}
                — registres officiels.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Reveal>
  );
}
