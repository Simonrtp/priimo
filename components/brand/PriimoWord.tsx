import type { ReactNode } from 'react';

export const PRIIMO_BRAND_COLOR = '#E8743C';

type PriimoWordProps = {
  className?: string;
  children?: ReactNode;
};

/** Mot de marque Priimo : Libre Baskerville + orange #E8743C */
export function PriimoWord({ className = '', children = 'Priimo' }: PriimoWordProps) {
  return (
    <span className={`font-brand text-[#E8743C] ${className}`.trim()}>{children}</span>
  );
}

/** Met en forme chaque occurrence de « Priimo » dans un texte. */
export function renderWithPriimoBrand(text: string): ReactNode[] {
  if (!text) return [];

  const parts = text.split(/(Priimo)/gi);
  return parts.map((part, i) =>
    /^priimo$/i.test(part) ? (
      <PriimoWord key={`priimo-${i}`}>{part}</PriimoWord>
    ) : (
      <span key={`text-${i}`}>{part}</span>
    ),
  );
}
