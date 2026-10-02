'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { playRecordStartSound } from '@/lib/voice/feedback-sound';
import { requestMicStream, stopMicStream } from '@/lib/voice/mic';
import { prechaufferTempsReel, preparerTempsReel, type PreparationTempsReel } from '@/lib/voice/temps-reel';
import { useDevice } from '@/components/dashboard/device/DeviceProvider';
// Le geste reste chargé d'office : il doit suivre le doigt dès le premier appui.
import VoiceGestureCapture, { type VoiceGestureCaptureHandle } from './VoiceGestureCapture';
import type { EstimationVoiceDraft } from '@/lib/estimation/voice-extract';

// Les feuilles de dictée et de note écrite pèsent plus de 100 ko : elles ne
// partent plus avec chaque écran du dashboard. Elles se chargent au repos,
// après l'affichage, et sont prêtes avant le premier toucher du micro.
const chargerDicterMobile = () => import('@/app/dashboard/_mobile/DicterMobile');
const chargerVoiceCaptureDialog = () => import('./VoiceCaptureDialog');
const chargerTypedNoteDialog = () => import('@/components/dashboard/notes/TypedNoteDialog');
const DicterMobile = dynamic(chargerDicterMobile, { ssr: false });
const VoiceCaptureDialog = dynamic(chargerVoiceCaptureDialog, { ssr: false });
const TypedNoteDialog = dynamic(chargerTypedNoteDialog, { ssr: false });

export type VoiceCapturePurpose = 'note' | 'estimation';

export type VoiceCaptureOptions = {
  adresse?: string;
  parcelleId?: string;
  /** Immeuble BAN : la note y est rattachée d’office. */
  banId?: string;
  /** Ne pas quitter la page après validation (ex. prise en main). */
  resterSurPage?: boolean;
  /** Dictée d’un bien visité, pour pré-remplir le formulaire d’estimation. */
  purpose?: VoiceCapturePurpose;
  onEstimationDraft?: (
    draft: EstimationVoiceDraft,
    opts?: import('@/lib/estimation/voice-extract').EstimationVoiceApplyOpts,
  ) => void;
};

export type ModeCapture = 'voix' | 'ecrit';

interface VoiceCaptureContextValue {
  openCapture: (opts?: VoiceCaptureOptions) => void;
  /** La même feuille que la dictée, au clavier : même lecture, mêmes cartes. */
  openEcrire: (opts?: VoiceCaptureOptions) => void;
  openCompose: (opts?: VoiceCaptureOptions) => void;
  beginGestureCapture: (opts?: VoiceCaptureOptions) => void;
  gestureActive: boolean;
  gestureLocked: boolean;
  captureSessionOpen: boolean;
  capturePurpose: VoiceCapturePurpose | null;
  gesturePointerMove: (deltaY: number, deltaX?: number) => void;
  gesturePointerUp: () => void;
  gesturePointerCancel: () => void;
  stopLockedGesture: () => void;
}

const VoiceCaptureContext = createContext<VoiceCaptureContextValue | null>(null);

export function useVoiceCapture(): VoiceCaptureContextValue {
  const ctx = useContext(VoiceCaptureContext);
  if (!ctx) throw new Error('useVoiceCapture must be used within VoiceCaptureProvider');
  return ctx;
}

export default function VoiceCaptureProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [adresse, setAdresse] = useState<string | null>(null);
  const [parcelleId, setParcelleId] = useState<string | null>(null);
  const [banId, setBanId] = useState<string | null>(null);
  const [resterSurPage, setResterSurPage] = useState(false);
  const [purpose, setPurpose] = useState<VoiceCapturePurpose>('note');
  const [modeInitial, setModeInitial] = useState<ModeCapture>('voix');
  const estimationDraftRef = useRef<
    | ((
        draft: EstimationVoiceDraft,
        opts?: import('@/lib/estimation/voice-extract').EstimationVoiceApplyOpts,
      ) => void)
    | null
  >(null);
  const [gestureSession, setGestureSession] = useState<{ adresse: string | null } | null>(null);
  const [gestureLocked, setGestureLocked] = useState(false);
  const streamPromiseRef = useRef<Promise<MediaStream> | null>(null);
  /** Direct préparé dans le geste qui ouvre la dictée. */
  const [preparation, setPreparation] = useState<PreparationTempsReel | null>(null);
  const gestureRef = useRef<VoiceGestureCaptureHandle | null>(null);
  const device = useDevice();

  const openCapture = useCallback((opts?: VoiceCaptureOptions) => {
    if (gestureSession) return;
    // Si le compose était ouvert (ou bloqué derrière l’onboarding), on bascule.
    setComposeOpen(false);
    if (!streamPromiseRef.current) {
      streamPromiseRef.current = requestMicStream();
    }
    // Dans le geste : moteur audio, jeton et connexion du direct se préparent
    // pendant que le navigateur ouvre le micro.
    setPreparation((ancienne) => {
      ancienne?.abandonner();
      return preparerTempsReel();
    });
    if (device === 'mobile' && typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(10);
    }
    playRecordStartSound();
    setAdresse(opts?.adresse?.trim() || null);
    setParcelleId(opts?.parcelleId?.trim() || null);
    setBanId(opts?.banId?.trim() || null);
    setResterSurPage(opts?.resterSurPage === true);
    setPurpose(opts?.purpose ?? 'note');
    estimationDraftRef.current = opts?.onEstimationDraft ?? null;
    setModeInitial('voix');
    setOpen(true);
  }, [device, gestureSession]);

  const openEcrire = useCallback((opts?: VoiceCaptureOptions) => {
    if (gestureSession) return;
    setComposeOpen(false);
    // Pas de micro : l'agent écrit. Rien à préparer, rien à demander.
    const pending = streamPromiseRef.current;
    streamPromiseRef.current = null;
    if (pending) void pending.then(stopMicStream).catch(() => undefined);
    setPreparation((ancienne) => {
      ancienne?.abandonner();
      return null;
    });
    if (device === 'mobile' && typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([12, 40, 12]);
    }
    setAdresse(opts?.adresse?.trim() || null);
    setParcelleId(opts?.parcelleId?.trim() || null);
    setBanId(opts?.banId?.trim() || null);
    setResterSurPage(opts?.resterSurPage === true);
    setPurpose('note');
    estimationDraftRef.current = null;
    setModeInitial('ecrit');
    setOpen(true);
  }, [device, gestureSession]);

  const openCompose = useCallback((opts?: VoiceCaptureOptions) => {
    if (gestureSession) return;
    // Ferme une dictée éventuellement ouverte mais invisible (z-index / micro).
    const pending = streamPromiseRef.current;
    streamPromiseRef.current = null;
    if (pending) void pending.then(stopMicStream).catch(() => undefined);
    setOpen(false);
    setAdresse(opts?.adresse?.trim() || null);
    setParcelleId(opts?.parcelleId?.trim() || null);
    setBanId(opts?.banId?.trim() || null);
    setResterSurPage(opts?.resterSurPage === true);
    setComposeOpen(true);
  }, [gestureSession]);

  const beginGestureCapture = useCallback((opts?: VoiceCaptureOptions) => {
    if (gestureSession || open || composeOpen) return;
    if (!streamPromiseRef.current) {
      streamPromiseRef.current = requestMicStream();
    }
    // Dans le geste : moteur audio, jeton et connexion du direct se préparent
    // pendant que le navigateur ouvre le micro.
    setPreparation((ancienne) => {
      ancienne?.abandonner();
      return preparerTempsReel();
    });
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(10);
    }
    playRecordStartSound();
    setGestureLocked(false);
    setParcelleId(opts?.parcelleId?.trim() || null);
    setBanId(opts?.banId?.trim() || null);
    setGestureSession({ adresse: opts?.adresse?.trim() || null });
  }, [composeOpen, gestureSession, open]);

  const endGestureSession = useCallback(() => {
    setGestureSession(null);
    setGestureLocked(false);
    streamPromiseRef.current = null;
    // La dictée a consommé (ou libéré) la préparation du direct.
    setPreparation(null);
  }, []);

  const handleComposeClose = useCallback(() => {
    setAdresse(null);
    setParcelleId(null);
    setBanId(null);
    setResterSurPage(false);
    setPurpose('note');
    estimationDraftRef.current = null;
    setComposeOpen(false);
  }, []);

  const handleClose = useCallback(() => {
    const pending = streamPromiseRef.current;
    streamPromiseRef.current = null;
    setPreparation(null);
    setAdresse(null);
    setParcelleId(null);
    setBanId(null);
    setResterSurPage(false);
    setPurpose('note');
    estimationDraftRef.current = null;
    setOpen(false);
    if (pending) {
      void pending.then(stopMicStream).catch(() => undefined);
    }
  }, []);

  const captureSessionOpen = open || composeOpen || gestureSession != null;
  const capturePurpose = open ? purpose : null;

  const value = useMemo(
    () => ({
      openCapture,
      openEcrire,
      openCompose,
      beginGestureCapture,
      gestureActive: gestureSession != null,
      gestureLocked,
      captureSessionOpen,
      capturePurpose,
      gesturePointerMove: (deltaY: number, deltaX?: number) =>
        gestureRef.current?.pointerMove(deltaY, deltaX),
      gesturePointerUp: () => gestureRef.current?.pointerUp(),
      gesturePointerCancel: () => gestureRef.current?.pointerCancel(),
      stopLockedGesture: () => gestureRef.current?.stopLocked(),
    }),
    [
      beginGestureCapture,
      capturePurpose,
      captureSessionOpen,
      gestureLocked,
      gestureSession,
      openCapture,
      openCompose,
      openEcrire,
    ],
  );

  // Le jeton du direct et le code des feuilles se prennent au repos : le
  // premier toucher du micro n'attend ni notre serveur ni un téléchargement.
  // Le jeton vaut quinze minutes et se renouvelle à l'usage.
  useEffect(() => {
    const prendre = () => {
      void prechaufferTempsReel();
      void (device === 'mobile' ? chargerDicterMobile() : chargerVoiceCaptureDialog()).catch(() => undefined);
      void chargerTypedNoteDialog().catch(() => undefined);
    };
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number };
    if (w.requestIdleCallback) {
      w.requestIdleCallback(prendre);
      return;
    }
    const t = window.setTimeout(prendre, 2_000);
    return () => window.clearTimeout(t);
  }, [device]);

  useEffect(() => {
    return () => {
      const pending = streamPromiseRef.current;
      streamPromiseRef.current = null;
      if (pending) void pending.then(stopMicStream).catch(() => undefined);
    };
  }, []);

  return (
    <VoiceCaptureContext.Provider value={value}>
      {children}
      {gestureSession ? (
        <VoiceGestureCapture
          ref={gestureRef}
          adresse={gestureSession.adresse}
          parcelleId={parcelleId}
          banId={banId}
          streamPromise={streamPromiseRef.current}
            preparation={preparation}
          onLockedChange={setGestureLocked}
          onClose={endGestureSession}
        />
      ) : null}
      {open ? (
        device === 'mobile' ? (
          <DicterMobile
            onClose={handleClose}
            streamPromise={streamPromiseRef.current}
            preparation={preparation}
            modeInitial={modeInitial}
            adresse={adresse}
            parcelleId={parcelleId}
            banId={banId}
            resterSurPage={resterSurPage}
            purpose={purpose}
            onEstimationDraft={(draft, opts) => estimationDraftRef.current?.(draft, opts)}
          />
        ) : (
          <VoiceCaptureDialog
            onClose={handleClose}
            streamPromise={streamPromiseRef.current}
            preparation={preparation}
            modeInitial={modeInitial}
            adresse={adresse}
            parcelleId={parcelleId}
            banId={banId}
            resterSurPage={resterSurPage}
            purpose={purpose}
            onEstimationDraft={(draft, opts) => estimationDraftRef.current?.(draft, opts)}
          />
        )
      ) : null}
      {composeOpen ? (
        <TypedNoteDialog
          onClose={handleComposeClose}
          adresse={adresse}
          parcelleId={parcelleId}
          banId={banId}
          resterSurPage={resterSurPage}
        />
      ) : null}
    </VoiceCaptureContext.Provider>
  );
}
