import { Fragment } from 'react';
import { List, MapPin, Handshake, ArrowRight, type LucideIcon } from 'lucide-react';
import Reveal from '@/components/Reveal';

// === STEP FLOW (bloc F) ===
// Le parcours en 3 temps, relié par une flèche fine. Icône + titre court + une
// ligne. Horizontal sur desktop, empilé (flèche vers le bas) sur mobile.

type Step = {
  Icon: LucideIcon;
  kicker: string;
  title: string;
  line: string;
};

const STEPS: Step[] = [
  {
    Icon: List,
    kicker: 'Lundi',
    title: 'La liste arrive',
    line: 'Les meilleures adresses de la semaine, dans votre tableau de bord.',
  },
  {
    Icon: MapPin,
    kicker: 'La semaine',
    title: 'Vos agents travaillent',
    line: 'Terrain, appels, portes : chaque adresse est expliquée.',
  },
  {
    Icon: Handshake,
    kicker: 'Ensuite',
    title: 'Vous nous dites',
    line: 'Ce que ça a donné. Le retour affûte la liste suivante.',
  },
];

export default function StepFlow() {
  return (
    <div className="flex flex-col items-stretch gap-3 lg:flex-row lg:items-stretch lg:gap-2">
      {STEPS.map((step, i) => (
        <Fragment key={step.title}>
          <Reveal
            direction="up"
            delay={i * 110}
            className="flex-1 rounded-2xl border border-black/[0.06] bg-white p-5 shadow-[0_1px_2px_rgba(17,24,39,0.04),0_8px_22px_-12px_rgba(17,24,39,0.12)]"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FFF0E6] text-[#C25E2C]">
                <step.Icon size={19} strokeWidth={2} aria-hidden />
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#E8743C]">
                {step.kicker}
              </span>
              <span className="ml-auto flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-[12px] font-bold text-gray-400">
                {i + 1}
              </span>
            </div>
            <p className="mt-3 text-[16px] font-semibold leading-snug text-gray-900">
              {step.title}
            </p>
            <p className="mt-1 text-[13.5px] leading-relaxed text-gray-500">
              {step.line}
            </p>
          </Reveal>

          {i < STEPS.length - 1 && (
            <div
              className="flex shrink-0 items-center justify-center py-0.5 text-[#E8743C]/50 lg:py-0"
              aria-hidden
            >
              <ArrowRight size={22} strokeWidth={2} className="hidden lg:block" />
              <ArrowRight
                size={20}
                strokeWidth={2}
                className="block rotate-90 lg:hidden"
              />
            </div>
          )}
        </Fragment>
      ))}
    </div>
  );
}
