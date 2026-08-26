'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { armPointerShield } from '@/lib/ui/pointer-guard';

export default function BienPhotoLightbox({
  photos,
  index,
  title,
  onClose,
  onIndex,
}: {
  photos: readonly string[];
  index: number;
  title: string;
  onClose: () => void;
  onIndex: (next: number) => void;
}) {
  const current = photos[index];
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        armPointerShield();
        onClose();
      }
      if (e.key === 'ArrowLeft' && index > 0) {
        e.preventDefault();
        onIndex(index - 1);
      }
      if (e.key === 'ArrowRight' && index < photos.length - 1) {
        e.preventDefault();
        onIndex(index + 1);
      }
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey, true);
      previousFocusRef.current?.focus?.();
    };
  }, [index, photos.length, onClose, onIndex]);

  if (!current) return null;

  return createPortal(
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-[#1E3148]/88 p-4" role="presentation">
      <button
        type="button"
        className="absolute inset-0 cursor-zoom-out"
        aria-label="Fermer la photo"
        onPointerDown={(e) => {
          e.preventDefault();
          armPointerShield();
          onClose();
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${title}, photo ${index + 1} sur ${photos.length}`}
        className="relative z-[1] flex max-h-[min(92dvh,900px)] w-full max-w-5xl flex-col items-center"
      >
        <img
          src={current}
          alt=""
          className="max-h-[min(80dvh,820px)] w-auto max-w-full rounded-xl object-contain shadow-clay-lg"
        />
        <p className="mt-3 text-[13px] text-white/80">
          {index + 1} / {photos.length}
        </p>
        <button
          ref={closeRef}
          type="button"
          onClick={() => {
            armPointerShield();
            onClose();
          }}
          className="absolute -top-1 right-0 flex size-11 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          aria-label="Fermer"
        >
          <X size={20} strokeWidth={2} aria-hidden />
        </button>
        {index > 0 ? (
          <button
            type="button"
            onClick={() => onIndex(index - 1)}
            className="absolute left-0 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            aria-label="Photo précédente"
          >
            <ChevronLeft size={22} strokeWidth={2} aria-hidden />
          </button>
        ) : null}
        {index < photos.length - 1 ? (
          <button
            type="button"
            onClick={() => onIndex(index + 1)}
            className="absolute right-0 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            aria-label="Photo suivante"
          >
            <ChevronRight size={22} strokeWidth={2} aria-hidden />
          </button>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
