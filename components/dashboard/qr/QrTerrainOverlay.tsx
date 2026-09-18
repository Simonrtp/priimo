'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Nunito } from 'next/font/google';
import { X } from 'lucide-react';
import { notifySuccess } from '@/lib/notify';
import { armPointerShield } from '@/lib/ui/pointer-guard';
import {
  loadQrCard,
  patchQrSession,
  peekQrCard,
  type QrClientCard,
  type QrClientSession,
} from '@/lib/qr/client-session';

const nunito = Nunito({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
  display: 'swap',
});

const BG = '#DCEBFF';
const WELL = '#C5CDD6';

function requestClose(onClose: () => void) {
  armPointerShield();
  onClose();
}

export default function QrTerrainOverlay({ onClose }: { onClose: () => void }) {
  const titleId = useId();
  const descId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const peeked = peekQrCard();
  const [card, setCard] = useState<QrClientCard | null>(peeked);
  const [error, setError] = useState<string | null>(null);
  const lastCountRef = useRef(peeked?.session.contactsCrees ?? 0);

  useEffect(() => {
    let cancelled = false;
    void loadQrCard()
      .then((next) => {
        if (!cancelled) setCard(next);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Impossible d’ouvrir le QR.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const session = card?.session;
    if (!session) return;
    const prev = lastCountRef.current;
    const next = session.contactsCrees;
    lastCountRef.current = next;
    if (next <= prev) return;
    const who = [session.dernierScan?.prenom, session.dernierScan?.nom]
      .filter((p) => Boolean(p?.trim()))
      .join(' ')
      .trim();
    notifySuccess(who ? `${who} a été ajouté à la base` : 'Un lead a été ajouté à la base', {
      id: `qr-lead-${session.id}-${next}`,
    });
  }, [card?.session]);

  useEffect(() => {
    const session = card?.session;
    if (!session?.id || !session.vivant) return;
    const t = window.setInterval(() => {
      void fetch(`/api/dashboard/qr-session?id=${encodeURIComponent(session.id)}`)
        .then((res) => res.json())
        .then((data: { session?: QrClientSession }) => {
          if (!data.session) return;
          const next = data.session;
          patchQrSession(next);
          setCard((prev) => (prev ? { ...prev, session: next } : prev));
        })
        .catch(() => undefined);
    }, 1000);
    return () => window.clearInterval(t);
  }, [card?.session?.id, card?.session?.vivant]);

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      requestClose(onClose);
    }
    function onFocusIn(e: FocusEvent) {
      const root = dialogRef.current;
      if (!root || root.contains(e.target as Node)) return;
      closeRef.current?.focus();
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('focusin', onFocusIn);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus();
    };
  }, [onClose]);

  return createPortal(
    <div
      className={`${nunito.className} fixed inset-0 z-[140] flex items-end justify-center p-4 sm:items-center`}
      role="presentation"
      style={{
        paddingTop: 'max(1rem, env(safe-area-inset-top))',
        paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
      }}
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Fermer"
        onPointerDown={(e) => {
          e.preventDefault();
          requestClose(onClose);
        }}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="relative z-[1] flex w-full max-w-[22rem] flex-col overflow-hidden rounded-[28px] px-6 pb-7 pt-5 shadow-xl"
        style={{ backgroundColor: BG }}
      >
        <button
          ref={closeRef}
          type="button"
          onClick={() => requestClose(onClose)}
          aria-label="Fermer"
          className="absolute right-3 top-3 flex size-11 items-center justify-center rounded-full text-[#111] hover:bg-black/[0.06]"
        >
          <X size={18} strokeWidth={2.2} aria-hidden />
        </button>

        <div className="flex flex-col items-center pt-4 text-center">
          <img
            src="/bouclier (1).png"
            alt=""
            width={72}
            height={72}
            className="size-[72px] object-contain"
            aria-hidden
          />
          <h2
            id={titleId}
            className="mt-5 text-balance text-[26px] font-extrabold leading-tight text-[#111]"
          >
            SCAN sécurisée
          </h2>
          <p id={descId} className="mt-2 text-pretty text-[14px] font-medium text-[#3A4553]">
            Saisie légal et conforme RGPD.
          </p>

          <div
            className="mt-8 flex aspect-square w-full items-center justify-center overflow-hidden rounded-[28px]"
            style={{ backgroundColor: WELL }}
          >
            {error ? (
              <p className="px-5 text-pretty text-[14px] text-[#3A4553]">{error}</p>
            ) : card?.image ? (
              <img
                src={card.image}
                alt="QR code à présenter"
                width={480}
                height={480}
                className="size-full object-cover"
              />
            ) : (
              <div className="size-full" aria-hidden />
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
