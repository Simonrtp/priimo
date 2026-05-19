'use client';

import { CircleHelp } from 'lucide-react';
import { useId } from 'react';

export type InfoTooltipPlacement = 'top-start' | 'top-end' | 'left' | 'right';

const PLACEMENT_CLASS: Record<InfoTooltipPlacement, string> = {
  /** Au-dessus du ?, ancré à gauche — la bulle s'étend vers la droite (drawer / labels à gauche). */
  'top-start': 'bottom-full left-0 mb-2',
  /** Au-dessus du ?, ancré à droite — la bulle s'étend vers la gauche. */
  'top-end': 'bottom-full right-0 mb-2',
  /** À gauche du ? */
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  /** À droite du ? */
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
};

interface InfoTooltipProps {
  content: string;
  placement?: InfoTooltipPlacement;
  className?: string;
  iconSize?: number;
}

export default function InfoTooltip({
  content,
  placement = 'top-start',
  className = '',
  iconSize = 14,
}: InfoTooltipProps) {
  const tooltipId = useId();

  return (
    <span className={`group relative inline-flex shrink-0 align-middle ${className}`}>
      <button
        type="button"
        className="inline-flex rounded-full text-mute/80 transition-colors hover:text-mute focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
        aria-describedby={tooltipId}
        tabIndex={0}
      >
        <CircleHelp size={iconSize} strokeWidth={2} aria-hidden />
      </button>
      <span
        id={tooltipId}
        role="tooltip"
        className={`pointer-events-none absolute z-50 hidden w-max max-w-[280px] rounded-xl bg-ink px-3 py-2.5 text-left text-[11px] font-normal leading-snug text-white shadow-lg group-hover:block group-focus-within:block ${PLACEMENT_CLASS[placement]}`}
      >
        {content}
      </span>
    </span>
  );
}
