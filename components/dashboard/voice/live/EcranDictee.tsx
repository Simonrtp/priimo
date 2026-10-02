'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Keyboard, MapPin, Mic, Square, X } from 'lucide-react';
import VoiceWaveform from '../VoiceWaveform';
import CartesComprises from './CartesComprises';
import type { CarteComprise } from '@/lib/voice/cartes';
import styles from './dictee.module.css';

function chrono(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * L'écran de la dictée : ce que Priimo comprend se range en cartes. Le texte
 * dicté reste hors écran — seul un lecteur d'écran l'entend. Un bouton pour
 * finir, ou la voix : « fin de note ».
 */
export default function EcranDictee({
  variant,
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
  mode = 'voix',
  onStop,
  onCancel,
  onRetry,
  onEcrire,
  onDicter,
  onTexte,
  onTerminerEcrit,
}: {
  variant: 'desktop' | 'mobile';
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
  /** À la voix, ou au clavier dans la même feuille. */
  mode?: 'voix' | 'ecrit';
  onStop: () => void;
  onCancel: () => void;
  onRetry: () => void;
  /** Passer au clavier ; absent quand l'écrit n'a pas de sens (estimation). */
  onEcrire?: () => void;
  onDicter?: () => void;
  onTexte?: (texte: string) => void;
  onTerminerEcrit?: () => void;
}) {
  const [maintenant, setMaintenant] = useState(() => Date.now());

  useEffect(() => {
    if (!micReady) return;
    const t = window.setInterval(() => setMaintenant(Date.now()), 500);
    return () => window.clearInterval(t);
  }, [micReady]);

  const mobile = variant === 'mobile';
  const ecrit = mode === 'ecrit';
  const titre = ecrit ? 'Écrire une note' : hasPriorTake ? 'Compléter la dictée' : 'Dicter une note';
  const champ = useRef<HTMLTextAreaElement | null>(null);

  // Au clavier, le curseur est déjà dans le champ.
  useEffect(() => {
    if (!ecrit) return;
    const t = window.setTimeout(() => {
      const el = champ.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }, 60);
    return () => window.clearTimeout(t);
  }, [ecrit]);

  const entete = (
    <header className="flex flex-shrink-0 items-center gap-2.5 px-5 pb-2 pt-4">
      {ecrit ? (
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary-50 px-2.5 py-1 text-[12px] font-semibold text-primary-600">
          <Keyboard size={13} strokeWidth={2.2} aria-hidden />
          Au clavier
        </span>
      ) : (
        <span
          className={`inline-flex shrink-0 items-center gap-2 rounded-full bg-primary-50 px-2.5 py-1 text-[12px] font-semibold text-primary-600 ${
            micReady ? '' : 'opacity-60'
          }`}
          title={direct ? 'Transcription en direct' : undefined}
        >
          <span className={`size-2 rounded-full bg-primary-500 ${micReady ? styles.pastilleDirect : ''}`} aria-hidden />
          <span className="tabular-nums">{micReady ? chrono(maintenant - demarreLe) : '0:00'}</span>
        </span>
      )}
      <span className="inline-flex min-w-0 flex-1 items-center gap-1 text-[12px] text-text-muted">
        {adresse ? (
          <>
            <MapPin size={13} strokeWidth={2} aria-hidden className="shrink-0" />
            <span className="truncate">{adresse}</span>
          </>
        ) : null}
      </span>
      <button
        type="button"
        onClick={onCancel}
        aria-label={ecrit ? 'Fermer' : hasPriorTake ? 'Revenir à la note sans cette prise' : 'Annuler la dictée'}
        className="flex size-9 flex-shrink-0 items-center justify-center rounded-full text-text-subtle transition-colors hover:bg-black/[0.04] hover:text-text"
      >
        <X size={18} strokeWidth={2} aria-hidden />
      </button>
    </header>
  );

  const corps = (
    <div className="flex min-h-0 flex-1 flex-col gap-4 px-5">
      <h2 className="sr-only">{titre}</h2>
      {ecrit ? (
        <textarea
          ref={champ}
          value={transcript}
          onChange={(e) => onTexte?.(e.target.value)}
          rows={4}
          aria-label="Votre note"
          placeholder="Écrivez comme vous le diriez : qui, où, ce qu’il faut faire…"
          className="min-h-[7.5rem] w-full shrink-0 resize-none rounded-2xl bg-bg-subtle px-4 py-3 text-[16px] leading-relaxed text-text-strong outline-none placeholder:text-text-subtle focus:ring-2 focus:ring-primary-200"
        />
      ) : (
        <p className="sr-only" aria-live="polite" aria-atomic="false">
          {transcript}
        </p>
      )}
      <div
        className={`min-h-0 flex-1 overflow-y-auto overscroll-contain pb-1 ${
          mobile ? '' : 'max-h-[52vh]'
        }`}
      >
        {cartes.length > 0 ? (
          <CartesComprises cartes={cartes} lecture={lecture} compact={mobile} />
        ) : ecrit ? null : (
          <p className="text-[15px] leading-relaxed text-text-subtle">
            {hasPriorTake ? 'Ajoutez ce qui manque…' : 'Je vous écoute…'}
          </p>
        )}
      </div>
      {error ? (
        <p className="text-pretty text-[13px] text-text" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );

  const commandes = (
    <footer
      className="flex flex-shrink-0 items-center justify-center gap-6 px-5 pb-6 pt-4"
      style={mobile ? { paddingBottom: 'calc(24px + env(safe-area-inset-bottom, 0px))' } : undefined}
    >
      {ecrit ? (
        <>
          <span className="flex w-16 justify-center">
            {onDicter ? (
              <BoutonSecondaire onClick={onDicter} libelle="Dicter" icone={<Mic size={19} strokeWidth={2.2} aria-hidden />} />
            ) : null}
          </span>
          <button
            type="button"
            onClick={onTerminerEcrit}
            disabled={transcript.trim().length < 3}
            aria-label="Terminer la note"
            className={`relative flex items-center justify-center rounded-full bg-primary-500 text-white shadow-clay-primary transition-transform duration-150 ease-clay hover:bg-primary-600 active:scale-95 disabled:opacity-50 ${
              mobile ? 'size-[72px]' : 'size-16'
            }`}
          >
            <Check size={mobile ? 30 : 28} strokeWidth={2.6} aria-hidden />
          </button>
          <span className="w-16" aria-hidden />
        </>
      ) : error && !micReady ? (
        <button
          type="button"
          onClick={onRetry}
          className="h-12 rounded-full bg-primary-500 px-6 text-[15px] font-semibold text-white shadow-clay-primary transition-transform active:scale-95"
        >
          Reprendre
        </button>
      ) : (
        <>
          <span className="w-16">
            <VoiceWaveform stream={micStream} compact />
          </span>
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
              className={`relative flex items-center justify-center rounded-full bg-primary-500 text-white shadow-clay-primary transition-transform duration-150 ease-clay hover:bg-primary-600 active:scale-95 disabled:opacity-60 ${
                mobile ? 'size-[72px]' : 'size-16'
              }`}
            >
              <Square size={mobile ? 24 : 22} strokeWidth={0} fill="currentColor" aria-hidden />
            </button>
          </span>
          <span className="flex w-16 justify-center">
            {onEcrire ? (
              <BoutonSecondaire
                onClick={onEcrire}
                libelle="Écrire"
                icone={<Keyboard size={19} strokeWidth={2.2} aria-hidden />}
              />
            ) : null}
          </span>
        </>
      )}
    </footer>
  );

  if (mobile) {
    return (
      <div className="fixed inset-0 z-[220] flex flex-col justify-end bg-[rgba(26,42,86,0.42)]" role="presentation">
        <div
          role="dialog"
          aria-modal="true"
          aria-label={titre}
          className="flex h-[86dvh] w-full flex-col overflow-hidden rounded-t-clay-xl bg-surface shadow-clay-lg"
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

/** Bascule voix ↔ clavier : discrète, à côté du geste principal. */
function BoutonSecondaire({
  onClick,
  libelle,
  icone,
}: {
  onClick: () => void;
  libelle: string;
  icone: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1 text-[11px] font-semibold text-text-muted transition-colors hover:text-text-strong"
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-primary-50 text-primary-600 transition-transform active:scale-95">
        {icone}
      </span>
      {libelle}
    </button>
  );
}
