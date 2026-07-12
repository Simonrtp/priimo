import {
  FileText,
  TrendingUp,
  Building2,
  LayoutGrid,
  Hammer,
  type LucideIcon,
} from 'lucide-react';
import Reveal from '@/components/Reveal';

// === SOURCE GRID (bloc C) ===
// Les cinq bases publiques croisées par Priimo. Icône + source + apport en une
// ligne. 2 colonnes mobile / 3 colonnes desktop, léger lift au survol.

type Source = {
  Icon: LucideIcon;
  name: string;
  brings: string;
};

const SOURCES: Source[] = [
  { Icon: FileText, name: 'DPE — ADEME', brings: 'L’intention de vendre' },
  { Icon: TrendingUp, name: 'DVF', brings: 'Les ventes réelles' },
  { Icon: Building2, name: 'BODACC', brings: 'Les SCI qui bougent' },
  {
    Icon: LayoutGrid,
    name: 'Registre des copropriétés',
    brings: 'Les copros fragilisées',
  },
  { Icon: Hammer, name: 'Permis de construire', brings: 'Les chantiers en cours' },
];

export default function SourceGrid() {
  return (
    <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
      {SOURCES.map(({ Icon, name, brings }, i) => (
        <Reveal key={name} direction="up" delay={i * 70}>
          <div className="group h-full rounded-2xl border border-black/[0.06] bg-white p-4 shadow-[0_1px_2px_rgba(17,24,39,0.04),0_6px_18px_-8px_rgba(17,24,39,0.10)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_30px_-10px_rgba(232,116,60,0.28)] sm:p-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFF0E6] text-[#C25E2C] transition-colors duration-300 group-hover:bg-[#FCE4D4]">
              <Icon size={19} strokeWidth={2} aria-hidden />
            </span>
            <p className="mt-3 text-[14px] font-semibold leading-snug text-gray-900 sm:text-[15px]">
              {name}
            </p>
            <p className="mt-1 text-[12.5px] leading-snug text-gray-500 sm:text-[13px]">
              {brings}
            </p>
          </div>
        </Reveal>
      ))}
    </div>
  );
}
