import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import Reveal from '@/components/Reveal';

// === FEATURE SPLIT (bloc A) ===
// Deux colonnes alternées : texte d'un côté (H2 orange + paragraphes + liste à
// puces optionnelle avec icônes), visuel de l'autre. Le sens s'inverse via
// `reversed`. Sur mobile, tout s'empile — le texte reste en premier dans le DOM.

export type SplitBullet = {
  Icon: LucideIcon;
  text: string;
};

type FeatureSplitProps = {
  id?: string;
  title: string;
  paragraphs: string[];
  bullets?: SplitBullet[];
  visual: ReactNode;
  /** Visuel à gauche, texte à droite. */
  reversed?: boolean;
  /** Extra sous le texte (ex. StatusChips). */
  children?: ReactNode;
};

export default function FeatureSplit({
  id,
  title,
  paragraphs,
  bullets,
  visual,
  reversed = false,
  children,
}: FeatureSplitProps) {
  return (
    <div
      className={`flex flex-col gap-8 sm:gap-10 lg:flex-row lg:items-center lg:gap-14 ${
        reversed ? 'lg:flex-row-reverse' : ''
      }`}
    >
      {/* Colonne texte */}
      <Reveal
        direction={reversed ? 'left' : 'right'}
        className="min-w-0 lg:flex-1 lg:max-w-[540px]"
      >
        <h2
          id={id}
          className={`blog-prose-h2 !mt-0 ${id ? 'blog-scroll-anchor' : ''}`}
        >
          {title}
        </h2>
        {paragraphs.map((p) => (
          <p key={p} className="blog-prose-p text-pretty">
            {p}
          </p>
        ))}

        {bullets && bullets.length > 0 && (
          <ul className="mt-5 space-y-2.5">
            {bullets.map(({ Icon, text }) => (
              <li key={text} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#FFF0E6] text-[#C25E2C]">
                  <Icon size={14} strokeWidth={2.25} aria-hidden />
                </span>
                <span className="text-[15px] leading-relaxed text-gray-700 sm:text-base">
                  {text}
                </span>
              </li>
            ))}
          </ul>
        )}

        {children}
      </Reveal>

      {/* Colonne visuelle */}
      <Reveal
        direction="scale"
        delay={120}
        className="flex min-w-0 justify-center lg:flex-1"
      >
        <div className="min-w-0">{visual}</div>
      </Reveal>
    </div>
  );
}
