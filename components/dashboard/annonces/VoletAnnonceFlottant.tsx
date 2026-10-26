'use client';

import { useEffect } from 'react';
import AnnonceVolet from './AnnonceVolet';
import type { Annonce } from '@/lib/annonces/types';

/**
 * Le volet d'une annonce, posé sur la page : à droite sur ordinateur (la page
 * s'assombrit), plein écran sur téléphone. Le même dans
 * la Liste et dans le Pipeline. Échap ou un clic à côté le referme.
 */
export default function VoletAnnonceFlottant({
  annonce,
  soeurs,
  onFermer,
}: {
  annonce: Annonce;
  soeurs: Annonce[];
  onFermer: () => void;
}) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFermer();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onFermer]);

  return (
    <>
      <div
        role="presentation"
        aria-hidden
        className="fixed inset-0 z-40 hidden bg-black/15 md:block"
        onClick={onFermer}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Annonce"
        className="fixed inset-0 z-[70] flex flex-col bg-black/15 p-3 pt-[max(12px,env(safe-area-inset-top))] md:inset-auto md:bottom-4 md:right-4 md:top-16 md:z-50 md:w-[380px] md:bg-transparent md:p-0"
      >
        <AnnonceVolet annonce={annonce} soeurs={soeurs} onFermer={onFermer} />
      </div>
    </>
  );
}
