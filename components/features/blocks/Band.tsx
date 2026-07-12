import type { ReactNode } from 'react';

// === BAND ===
// Bande de section pleine largeur pour les pages /fonctionnalites/*.
// Gère le fond (ton), le conteneur centré (max 1200px) et le rythme vertical.
// Les colonnes de texte pur restent bornées à ~640px à l'intérieur ; les blocs
// visuels, cartes et grilles occupent toute la largeur du conteneur.

type Tone = 'white' | 'cream' | 'canvas';

const TONE_BG: Record<Tone, string> = {
  white: 'bg-white',
  cream: 'bg-[#FFF7F0]',
  canvas: 'bg-canvas',
};

type BandProps = {
  children: ReactNode;
  tone?: Tone;
  id?: string;
  /** Rythme vertical. `tight` pour enchaîner des blocs denses. */
  space?: 'tight' | 'normal';
  className?: string;
};

export default function Band({
  children,
  tone = 'white',
  id,
  space = 'normal',
  className = '',
}: BandProps) {
  const pad = space === 'tight' ? 'py-9 sm:py-12' : 'py-12 sm:py-16';
  return (
    <section
      id={id}
      className={`${TONE_BG[tone]} ${id ? 'blog-scroll-anchor' : ''}`}
    >
      <div className={`mx-auto max-w-[1200px] px-5 sm:px-8 min-w-0 ${pad} ${className}`}>
        {children}
      </div>
    </section>
  );
}
