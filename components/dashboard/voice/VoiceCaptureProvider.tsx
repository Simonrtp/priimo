'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { playRecordStartSound } from '@/lib/voice/feedback-sound';
import { requestMicStream, stopMicStream } from '@/lib/voice/mic';
import { useDevice } from '@/components/dashboard/device/DeviceProvider';
import DicterMobile from '@/app/dashboard/_mobile/DicterMobile';
import VoiceCaptureDialog from './VoiceCaptureDialog';
import VoiceGestureCapture, { type VoiceGestureCaptureHandle } from './VoiceGestureCapture';

export type VoiceCaptureOptions = {
  adresse?: string;
};

interface VoiceCaptureContextValue {
  openCapture: (opts?: VoiceCaptureOptions) => void;
  beginGestureCapture: (opts?: VoiceCaptureOptions) => void;
  gestureActive: boolean;
  gestureLocked: boolean;
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
  const [adresse, setAdresse] = useState<string | null>(null);
  const [gestureSession, setGestureSession] = useState<{ adresse: string | null } | null>(null);
  const [gestureLocked, setGestureLocked] = useState(false);
  const streamPromiseRef = useRef<Promise<MediaStream> | null>(null);
  const gestureRef = useRef<VoiceGestureCaptureHandle | null>(null);
  const device = useDevice();

  const openCapture = useCallback((opts?: VoiceCaptureOptions) => {
    if (gestureSession) return;
    if (!streamPromiseRef.current) {
      streamPromiseRef.current = requestMicStream();
    }
    if (device === 'mobile' && typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(10);
    }
    playRecordStartSound();
    setAdresse(opts?.adresse?.trim() || null);
    setOpen(true);
  }, [device, gestureSession]);

  const beginGestureCapture = useCallback((opts?: VoiceCaptureOptions) => {
    if (gestureSession || open) return;
    if (!streamPromiseRef.current) {
      streamPromiseRef.current = requestMicStream();
    }
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(10);
    }
    playRecordStartSound();
    setGestureLocked(false);
    setGestureSession({ adresse: opts?.adresse?.trim() || null });
  }, [gestureSession, open]);

  const endGestureSession = useCallback(() => {
    setGestureSession(null);
    setGestureLocked(false);
    streamPromiseRef.current = null;
  }, []);

  const handleClose = useCallback(() => {
    const pending = streamPromiseRef.current;
    streamPromiseRef.current = null;
    setAdresse(null);
    setOpen(false);
    if (pending) {
      void pending.then(stopMicStream).catch(() => undefined);
    }
  }, []);

  const value = useMemo(
    () => ({
      openCapture,
      beginGestureCapture,
      gestureActive: gestureSession != null,
      gestureLocked,
      gesturePointerMove: (deltaY: number, deltaX?: number) =>
        gestureRef.current?.pointerMove(deltaY, deltaX),
      gesturePointerUp: () => gestureRef.current?.pointerUp(),
      gesturePointerCancel: () => gestureRef.current?.pointerCancel(),
      stopLockedGesture: () => gestureRef.current?.stopLocked(),
    }),
    [beginGestureCapture, gestureLocked, gestureSession, openCapture],
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
          />
        ) : (
          <VoiceCaptureDialog onClose={handleClose} streamPromise={streamPromiseRef.current} adresse={adresse} />
        )
      ) : null}
    </VoiceCaptureContext.Provider>
  );
}
