'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { QrCode, X } from 'lucide-react';
import { notifySuccess } from '@/lib/notify';
import { FIELD } from '@/lib/today/field';

type Session = {
  id: string;
  expireLe: string;
  plafond: number;
  contactsCrees: number;
  vivant: boolean;
  dernierScan: { prenom: string; nom: string; le: string } | null;
};

function formatExpire(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(new Date(t));
}

export default function QrTerrainOverlay({ onClose }: { onClose: () => void }) {
  const titleId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastCountRef = useRef(0);
  const [url, setUrl] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/dashboard/qr-session', { method: 'POST' });
        const data = (await res.json()) as { url?: string; session?: Session; error?: string };
        if (cancelled) return;
        if (!res.ok || !data.url || !data.session) {
          setError(data.error ?? 'Impossible d’ouvrir le QR.');
          setLoading(false);
          return;
        }
        setUrl(data.url);
        setSession(data.session);
        setLoading(false);
      } catch {
        if (!cancelled) {
          setError('Impossible d’ouvrir le QR.');
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!url || !canvasRef.current) return;
    let cancelled = false;
    void import('qrcode').then((QRCode) => {
      if (cancelled || !canvasRef.current) return;
      void QRCode.toCanvas(canvasRef.current, url, {
        width: 280,
        margin: 2,
        color: { dark: FIELD.orange, light: '#FFFFFF' },
        errorCorrectionLevel: 'M',
      });
    });
    return () => {
      cancelled = true;
    };
  }, [url]);

  useEffect(() => {
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
  }, [session]);

  useEffect(() => {
    if (!session?.id || !session.vivant) return;
    const t = window.setInterval(() => {
      void fetch(`/api/dashboard/qr-session?id=${encodeURIComponent(session.id)}`)
        .then((res) => res.json())
        .then((data: { session?: Session }) => {
          if (data.session) setSession(data.session);
        })
        .catch(() => undefined);
    }, 1000);
    return () => window.clearInterval(t);
  }, [session?.id, session?.vivant]);

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }
    function onFocusIn(e: FocusEvent) {
      const root = rootRef.current;
      if (!root || root.contains(e.target as Node)) return;
      closeRef.current?.focus();
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('focusin', onFocusIn);
      previouslyFocused?.focus();
    };
  }, [onClose]);

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-[140] flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      style={{
        backgroundColor: FIELD.creme,
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div className="flex items-center justify-between px-4 py-3">
        <p className="flex items-center gap-2 text-[13px] font-medium" style={{ color: FIELD.orange }}>
          <QrCode size={16} strokeWidth={2} aria-hidden />
          Consentement
        </p>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="app-press flex size-11 items-center justify-center rounded-full text-text-muted"
        >
          <X size={22} strokeWidth={2} aria-hidden />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 pb-8 text-center">
        <h2 id={titleId} className="max-w-[16rem] text-balance font-display text-[28px] font-semibold leading-tight text-[#15202F]">
          Montrez ce code
        </h2>
        <p className="mt-2 max-w-[18rem] text-pretty text-[15px] text-text-muted">
          Il le scanne avec son téléphone. Rien n’est prérempli : c’est lui qui saisit.
        </p>

        <div className="mt-8 rounded-[28px] bg-white p-5 shadow-[0_18px_40px_-24px_rgba(232,116,60,0.45)]">
          {loading ? (
            <div className="size-[280px] animate-pulse rounded-2xl bg-black/[0.04]" aria-hidden />
          ) : error ? (
            <p className="flex size-[280px] items-center justify-center px-6 text-[15px] text-text-muted">{error}</p>
          ) : (
            <canvas ref={canvasRef} width={280} height={280} className="size-[280px]" aria-label="QR code à présenter" />
          )}
        </div>

        {session ? (
          <p className="mt-6 tabular-nums text-[13.5px] text-text-muted" aria-live="polite">
            {session.contactsCrees === 0
              ? 'En attente du premier scan'
              : `${session.contactsCrees} contact${session.contactsCrees > 1 ? 's' : ''} reçu${session.contactsCrees > 1 ? 's' : ''}`}
            {session.vivant ? ` · expire à ${formatExpire(session.expireLe)}` : ' · code fermé'}
          </p>
        ) : null}
      </div>
    </div>
  );
}
