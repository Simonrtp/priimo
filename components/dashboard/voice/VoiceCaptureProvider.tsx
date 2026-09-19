'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { playRecordStartSound } from '@/lib/voice/feedback-sound';
import { requestMicStream, stopMicStream } from '@/lib/voice/mic';
import { useDevice } from '@/components/dashboard/device/DeviceProvider';
import DicterMobile from '@/app/dashboard/_mobile/DicterMobile';
import VoiceCaptureDialog from './VoiceCaptureDialog';
import VoiceGestureCapture, { type VoiceGestureCaptureHandle } from './VoiceGestureCapture';
import TypedNoteDialog from '@/components/dashboard/notes/TypedNoteDialog';
import type { EstimationVoiceDraft } from '@/lib/estimation/voice-extract';

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
  onEstimationDraft?: (draft: EstimationVoiceDraft) => void;
};

interface VoiceCaptureContextValue {
  openCapture: (opts?: VoiceCaptureOptions) => void;
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
  const estimationDraftRef = useRef<((draft: EstimationVoiceDraft) => void) | null>(null);
  const [gestureSession, setGestureSession] = useState<{ adresse: string | null } | null>(null);
  const [gestureLocked, setGestureLocked] = useState(false);
  const streamPromiseRef = useRef<Promise<MediaStream> | null>(null);
  const gestureRef = useRef<VoiceGestureCaptureHandle | null>(null);
  const device = useDevice();

  const openCapture = useCallback((opts?: VoiceCaptureOptions) => {
    if (gestureSession) return;
    // Si le compose était ouvert (ou bloqué derrière l’onboarding), on bascule.
    setComposeOpen(false);
    if (!streamPromiseRef.current) {
      streamPromiseRef.current = requestMicStream();
    }
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
    [beginGestureCapture, capturePurpose, captureSessionOpen, gestureLocked, gestureSession, openCapture, openCompose],
  );

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
          onLockedChange={setGestureLocked}
          onClose={endGestureSession}
        />
      ) : null}
      {open ? (
        device === 'mobile' ? (
          <DicterMobile
            onClose={handleClose}
            streamPromise={streamPromiseRef.current}
            adresse={adresse}
            parcelleId={parcelleId}
            banId={banId}
            resterSurPage={resterSurPage}
            purpose={purpose}
            onEstimationDraft={(draft) => estimationDraftRef.current?.(draft)}
          />
        ) : (
          <VoiceCaptureDialog
            onClose={handleClose}
            streamPromise={streamPromiseRef.current}
            adresse={adresse}
            parcelleId={parcelleId}
            banId={banId}
            resterSurPage={resterSurPage}
            purpose={purpose}
            onEstimationDraft={(draft) => estimationDraftRef.current?.(draft)}
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
