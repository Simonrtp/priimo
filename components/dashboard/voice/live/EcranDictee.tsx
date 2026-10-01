'use client';

import { useEffect, useState } from 'react';
import { MapPin, Square, X } from 'lucide-react';
import VoiceWaveform from '../VoiceWaveform';
import TranscriptionVivante from './TranscriptionVivante';
import CartesComprises from './CartesComprises';
import type { CarteComprise } from '@/lib/voice/cartes';
import styles from './dictee.module.css';

function chrono(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * L'écran de la dictée : ce que l'agent dit s'écrit à mesure, ce que Priimo en
 * comprend se range en cartes juste en dessous. Un seul geste pour finir — ou
 * la voix : « fin de note ».
 *
 * Sur mobile, une feuille haute, bouton sous le pouce. Sur ordinateur, une
 * fenêtre posée au centre.
 */
export default function EcranDictee({
  variant,
  phase,
  transcript,
  cartes,
  lecture,
  micStream,
  micReady,
  demarreLe,
  direct,
  adresse,
  error,
  hasPriorTake,
  onStop,
  onCancel,
  onRetry,
}: {
  variant: 'desktop' | 'mobile';
  phase: 'recording' | 'processing';
  transcript: string;
  cartes: readonly CarteComprise[];
  /** Une lecture de la dictée est en cours. */
  lecture: boolean;
  micStream: MediaStream | null;
  micReady: boolean;
  demarreLe: number;
  /** Transcription Voxtral Realtime active (sinon, repli par morceaux). */
  direct: boolean;
  adresse: string | null;
  error: string | null;
  hasPriorTake: boolean;
  onStop: () => void;
  onCancel: () => void;
  onRetry: () => void;
}) {
  const [maintenant, setMaintenant] = useState(() => Date.now());
  const enregistre = phase === 'recording' && micReady;

  useEffect(() => {
    if (!enregistre) return;
    const t = window.setInterval(() => setMaintenant(Date.now()), 500);
    return () => window.clearInterval(t);
  }, [enregistre]);

  const mobile = variant === 'mobile';
  const titre = hasPriorTake ? 'Compléter la dictée' : 'Dicter une note';

  const entete = (
    <header className="flex flex-shrink-0 items-center gap-3 px-5 pb-3 pt-4 sm:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        {phase === 'processing' ? (
          <span className="text-[12.5px] font-semibold text-text-muted">Rangement de la note…</span>
        ) : micReady ? (
          <span className="inline-flex items-center gap-2 rounded-full bg-primary-50 px-2.5 py-1 text-[12px] font-semibold text-primary-600">
            <span className={`size-2 rounded-full bg-primary-500 ${styles.pastilleDirect}`} aria-hidden />
            {direct ? 'En direct' : 'J’écoute'}
            <span className="tabular-nums text-primary-600">{chrono(maintenant - demarreLe)}</span>
          </span>
        ) : (
          <span className="text-[12.5px] font-semibold text-text-muted">Ouverture du micro…</span>
        )}
        {adresse ? (
          <span className="inline-flex min-w-0 items-center gap-1 text-[12px] text-text-muted">
            <MapPin size={13} strokeWidth={2} aria-hidden className="shrink-0" />
            <span className="truncate">{adresse}</span>
          </span>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onCancel}
        aria-label={hasPriorTake ? 'Revenir à la note sans cette prise' : 'Annuler la dictée'}
        className="flex size-9 flex-shrink-0 items-center justify-center rounded-xl text-text-subtle transition-colors hover:bg-black/[0.04] hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
      >
        <X size={18} strokeWidth={2} aria-hidden />
      </button>
    </header>
  );

  const corps = (
    <div className="flex min-h-0 flex-1 flex-col gap-4 px-5 sm:px-6">
      <h2 className="sr-only">{titre}</h2>
      <TranscriptionVivante
        texte={transcript}
        placeholder={
          hasPriorTake
            ? 'Ajoutez ce qui manque…'
            : 'Parlez naturellement : qui, où, ce qui a été dit, ce qu’il faut faire.'
        }
        className={mobile ? 'min-h-[96px] flex-1 text-[18px]' : 'max-h-[34vh] min-h-[110px] text-[17px]'}
      />
      {cartes.length > 0 ? (
        <section className={`flex min-h-0 flex-col gap-2 ${mobile ? 'max-h-[42%]' : 'max-h-[30vh]'}`}>
          <h3
            className="font-semibold uppercase text-text-subtle"
            style={{ fontSize: 10.5, letterSpacing: '0.08em' }}
          >
            Priimo a compris
          </h3>
          <div className="min-h-0 overflow-y-auto overscroll-contain pb-1">
            <CartesComprises cartes={cartes} lecture={lecture} compact={mobile} />
          </div>
        </section>
      ) : null}
      {error ? (
        <p className="text-pretty text-[13px] text-text" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );

  const commandes = (
    <footer
      className="flex flex-shrink-0 flex-col items-center gap-2 px-5 pb-5 pt-4 sm:px-6"
      style={mobile ? { paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))' } : undefined}
    >
      <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center">
        <div className="justify-self-start">
          <VoiceWaveform stream={phase === 'recording' ? micStream : null} compact />
        </div>
        {phase === 'processing' ? (
          <span
            className="flex size-16 items-center justify-center rounded-full bg-primary-50"
            aria-busy="true"
            aria-label="Rangement de la note"
          >
            <span className="size-7 rounded-full border-2 border-primary-200 border-t-primary-500 motion-safe:animate-spin" />
          </span>
        ) : error && !micReady ? (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-full bg-primary-500 px-6 py-3 text-[15px] font-semibold text-white shadow-clay-primary transition-transform active:scale-95"
          >
            Reprendre
          </button>
        ) : (
          <span className="relative inline-flex">
            {micReady ? (
              <>
                <span className={styles.ondeMicro} aria-hidden />
                <span className={styles.ondeMicro} aria-hidden />
              </>
            ) : null}
            <button
              type="button"
              onClick={onStop}
              disabled={!micReady}
              aria-label="Terminer la dictée"
              className={`relative flex items-center justify-center rounded-full bg-primary-500 text-white shadow-clay-primary transition-transform duration-150 ease-clay hover:bg-primary-600 active:scale-95 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary-500 ${
                mobile ? 'size-[72px]' : 'size-16'
              }`}
            >
              <Square size={mobile ? 24 : 22} strokeWidth={0} fill="currentColor" aria-hidden />
            </button>
          </span>
        )}
        <div className="justify-self-end">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-11 rounded-xl px-3 text-[13.5px] font-medium text-text-muted transition-colors hover:bg-black/[0.04] hover:text-text-strong"
          >
            {hasPriorTake ? 'Retour' : 'Annuler'}
          </button>
        </div>
      </div>
      {phase === 'recording' && micReady ? (
        <p className="text-center text-[12px] text-text-subtle">
          Touchez pour terminer, ou dites « fin de note ».
        </p>
      ) : null}
    </footer>
  );

  if (mobile) {
    return (
      <div className="fixed inset-0 z-[220] flex flex-col justify-end bg-[rgba(26,42,86,0.42)]" role="presentation">
        <div
          role="dialog"
          aria-modal="true"
          aria-label={titre}
          className="flex h-[88dvh] w-full flex-col overflow-hidden rounded-t-clay-xl bg-surface shadow-clay-lg"
        >
          <div className="flex justify-center pt-2.5" aria-hidden>
            <span className="h-1 w-10 rounded-full bg-black/10" />
          </div>
          {entete}
          {corps}
          {commandes}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-[rgba(26,42,86,0.45)] p-4" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titre}
        className="flex max-h-[88vh] w-full max-w-[560px] flex-col overflow-hidden rounded-clay-lg bg-surface shadow-clay-lg"
      >
        {entete}
        {corps}
        {commandes}
      </div>
    </div>
  );
}
