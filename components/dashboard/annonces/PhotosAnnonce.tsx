'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const FLECHE =
  'absolute top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-text-strong shadow-sm transition-colors duration-fluid-subtle hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1A2A56]';

export default function PhotosAnnonce({ photos, chargement }: { photos: string[] | null; chargement: boolean }) {
  const [index, setIndex] = useState(0);

  if (chargement || photos == null) {
    return <div className="mb-3 aspect-[4/3] w-full rounded-[16px] bg-black/[0.05]" aria-hidden />;
  }
  if (photos.length === 0) return null;

  const i = Math.min(index, photos.length - 1);
  const plusieurs = photos.length > 1;

  return (
    <div className="relative mb-3 overflow-hidden rounded-[16px] bg-black/[0.04]">
      <img
        src={photos[i]}
        alt={`Photo ${i + 1} sur ${photos.length}`}
        referrerPolicy="no-referrer"
        className="aspect-[4/3] w-full object-cover"
      />
      {plusieurs ? (
        <>
          <button
            type="button"
            aria-label="Photo précédente"
            className={`${FLECHE} left-2`}
            onClick={() => setIndex((n) => (n - 1 + photos.length) % photos.length)}
          >
            <ChevronLeft size={16} strokeWidth={2.2} aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Photo suivante"
            className={`${FLECHE} right-2`}
            onClick={() => setIndex((n) => (n + 1) % photos.length)}
          >
            <ChevronRight size={16} strokeWidth={2.2} aria-hidden />
          </button>
          <p className="pointer-events-none absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-white">
            {i + 1} / {photos.length}
          </p>
        </>
      ) : null}
    </div>
  );
}
