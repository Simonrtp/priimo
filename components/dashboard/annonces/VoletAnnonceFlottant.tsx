'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import AnnonceVolet from './AnnonceVolet';
import type { Annonce } from '@/lib/annonces/types';
import { armPointerShield } from '@/lib/ui/pointer-guard';

const abonnerRien = () => () => undefined;

/**
 * Fiche d’une annonce en carte centrée (même geste que Notes / Contacts).
 * Échap ou un clic à côté la referme. Portée dans le body pour échapper à
 * `contain: paint` de la coque.
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

  function fermer() {
    armPointerShield();
    onFermer();
  }

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      armPointerShield();
      onFermer();
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey, true);
    };
  }, [onFermer]);

  if (!estClient) return null;

  return createPortal(
    <div className="fixed inset-0 z-[130] flex items-end justify-center p-4 sm:items-center" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
        aria-label="Fermer"
        onPointerDown={(e) => {
          e.preventDefault();
          fermer();
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Annonce"
        className="relative z-[1] flex h-[min(720px,calc(100dvh-2rem))] w-full max-w-4xl flex-col overflow-hidden rounded-2xl shadow-xl"
      >
        <AnnonceVolet annonce={annonce} soeurs={soeurs} onFermer={fermer} large />
      </div>
    </div>,
    document.body,
  );
}
