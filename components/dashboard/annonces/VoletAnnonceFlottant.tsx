'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import AnnonceVolet from './AnnonceVolet';
import type { Annonce } from '@/lib/annonces/types';

const abonnerRien = () => () => undefined;

/**
 * Le volet d'une annonce, posé sur la page : à droite sur ordinateur (la page
 * s'assombrit), plein écran sur téléphone. Le même dans
 * la Liste et dans le Pipeline. Échap ou un clic à côté le referme.
 *
 * Porté dans la coque : la carte de travail (`contain: paint`) et les entrées
 * animées (transform) captureraient le `fixed`. La coque ne défile pas : le
 * volet reste en place, et le voile grise tout sauf le menu et la barre du haut.
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
  const estClient = useSyncExternalStore(abonnerRien, () => true, () => false);

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

  if (!estClient) return null;
  const coque = document.getElementById('dashboard-coque');
  const dansCoque = coque != null;

  return createPortal(
    <>
      <div
        role="presentation"
        aria-hidden
        className={`${dansCoque ? 'absolute' : 'fixed'} inset-0 z-40 hidden bg-black/15 md:block`}
        onClick={onFermer}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Annonce"
        className={`fixed inset-0 z-[70] flex flex-col bg-black/15 p-3 pt-[max(12px,env(safe-area-inset-top))] md:inset-auto md:z-50 md:w-[380px] md:bg-transparent md:p-0 ${
          // Dans la coque : 12 px à l'intérieur de la carte de travail.
          dansCoque
            ? 'md:absolute md:bottom-7 md:right-6 md:top-6 lg:bottom-8 lg:right-7 lg:top-7'
            : 'md:bottom-4 md:right-4 md:top-16'
        }`}
      >
        <AnnonceVolet annonce={annonce} soeurs={soeurs} onFermer={onFermer} />
      </div>
    </>,
    coque ?? document.body,
  );
}
