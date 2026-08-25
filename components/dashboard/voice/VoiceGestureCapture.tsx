'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { notifyError } from '@/lib/notify';
import { playRecordStopSound } from '@/lib/voice/feedback-sound';
import { micErrorMessage, pickAudioMimeType, requestMicStream, stopMicStream } from '@/lib/voice/mic';
import { readDevicePosition } from '@/lib/voice/gps';
import { reverseGeocode } from '@/lib/geo/ban';
import { shouldLockVoice, VOICE_LOCK_SWIPE_PX } from '@/lib/voice/gesture-lock';
import type { NoteReviewPayload } from '@/lib/notes/build-review';
import VoiceWaveform from './VoiceWaveform';
import VoiceLockHint from './VoiceLockHint';

export type VoiceGestureCaptureHandle = {
  pointerMove: (deltaY: number, deltaX?: number) => void;
  pointerUp: () => void;
  pointerCancel: () => void;
  stopLocked: () => void;
};

type Phase = 'recording' | 'processing' | 'saved';

const CARD_BOTTOM = 'calc(92px + env(safe-area-inset-bottom, 0px))';
const LOCK_HINT_BOTTOM = 'calc(144px + env(safe-area-inset-bottom, 0px))';

export default forwardRef<
  VoiceGestureCaptureHandle,
  {
    adresse?: string | null;
    parcelleIdu?: string | null;
    streamPromise?: Promise<MediaStream> | null;
    onLockedChange: (locked: boolean) => void;
    onClose: () => void;
  }
>(function VoiceGestureCapture({ adresse = null, parcelleIdu = null, streamPromise, onLockedChange, onClose }, ref) {
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>('recording');
  const [locked, setLocked] = useState(false);
  const [lockProgress, setLockProgress] = useState(0);
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const [micReady, setMicReady] = useState(false);
  const [voiceNoteId, setVoiceNoteId] = useState<string | null>(null);
  const [gpsAddress, setGpsAddress] = useState<string | null>(adresse);
  const [discarding, setDiscarding] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const cancelledRef = useRef(false);
  const lockedRef = useRef(false);
  const micReadyRef = useRef(false);
  const usedInitialStreamRef = useRef(false);
  const voiceNoteIdRef = useRef<string | null>(null);

  lockedRef.current = locked;
  micReadyRef.current = micReady;
  voiceNoteIdRef.current = voiceNoteId;

  useEffect(() => {
    onLockedChange(locked);
  }, [locked, onLockedChange]);

  useEffect(() => {
    if (adresse) setGpsAddress(adresse);
    void readDevicePosition().then(async (pos) => {
      if (!pos || adresse) return;
      const hit = await reverseGeocode(pos.latitude, pos.longitude);
      if (hit) setGpsAddress(hit.adresse_normalisee);
    });
  }, [adresse]);

  const releaseMic = useCallback(() => {
    stopMicStream(recorderRef.current?.stream);
    setMicStream(null);
    setMicReady(false);
  }, []);

  const finishRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== 'recording') return;
    recorder.stop();
    playRecordStopSound();
  }, []);

  const cancelAll = useCallback(() => {
    cancelledRef.current = true;
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop();
    }
    recorderRef.current = null;
    releaseMic();
    onClose();
  }, [onClose, releaseMic]);

  async function upload(blob: Blob, durationSeconds: number) {
    setPhase('processing');
    releaseMic();

    if (blob.size === 0) {
      notifyError('Aucun son reçu.');
      onClose();
      return;
    }

    const form = new FormData();
    form.append('audio', blob, 'dictee.webm');
    form.append('durationSeconds', String(durationSeconds));
    const gps = await readDevicePosition();
    if (gps) {
      form.append('latitude', String(gps.latitude));
      form.append('longitude', String(gps.longitude));
    }
    const addr = gpsAddress?.trim();
    if (addr) form.append('adresse', addr);
    if (parcelleIdu) form.append('parcelleIdu', parcelleIdu);

    try {
      const res = await fetch('/api/dashboard/voice-notes', { method: 'POST', body: form });
      const data = (await res.json()) as NoteReviewPayload & { error?: string };

      if (cancelledRef.current) {
        if (data.voiceNoteId) {
          void fetch(`/api/dashboard/voice-notes/${data.voiceNoteId}`, { method: 'DELETE' });
        }
        return;
      }

      if (!res.ok) {
        notifyError(data.error ?? "La dictée n'a pas pu être traitée");
        onClose();
        return;
      }

      setVoiceNoteId(data.voiceNoteId);
      if (data.voiceNoteId && data.transcript) {
        void fetch(`/api/dashboard/voice-notes/${data.voiceNoteId}/rafraichir`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcript: data.transcript }),
        });
      }
      try {
        await fetch(`/api/dashboard/voice-notes/${data.voiceNoteId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ terminer: true }),
        });
      } catch {
        // La note reste en brouillon si la finalisation échoue.
      }
      setPhase('saved');
      router.refresh();
    } catch {
      if (!cancelledRef.current) notifyError("La dictée n'a pas pu être traitée");
      onClose();
    }
  }

  const uploadRef = useRef(upload);
  uploadRef.current = upload;

  useEffect(() => {
    let cancelled = false;

    async function start() {
      cancelledRef.current = false;
      try {
        let stream: MediaStream;
        if (streamPromise && !usedInitialStreamRef.current) {
          usedInitialStreamRef.current = true;
          stream = await streamPromise;
        } else {
          stream = await requestMicStream();
        }
        if (cancelled || cancelledRef.current) {
          stopMicStream(stream);
          return;
        }

        const mimeType = pickAudioMimeType();
        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        chunksRef.current = [];

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };
        recorder.onstop = () => {
          const durationSeconds = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
          stopMicStream(stream);
          setMicStream(null);
          if (cancelledRef.current) {
            chunksRef.current = [];
            recorderRef.current = null;
            return;
          }
          const blob = new Blob(chunksRef.current, {
            type: recorder.mimeType || mimeType || 'audio/webm',
          });
          recorderRef.current = null;
          void uploadRef.current(blob, durationSeconds);
        };

        recorder.start(250);
        recorderRef.current = recorder;
        startedAtRef.current = Date.now();
        setMicStream(stream);
        setMicReady(true);
      } catch (error) {
        notifyError(micErrorMessage(error));
        onClose();
      }
    }

    void start();
    return () => {
      cancelled = true;
    };
  }, [onClose, streamPromise]);

  useEffect(() => {
    if (phase !== 'saved') return;
    const t = window.setTimeout(() => onClose(), 5000);
    return () => window.clearTimeout(t);
  }, [phase, onClose]);

  const tryLock = useCallback((deltaY: number, deltaX = 0) => {
    if (lockedRef.current) return;
    setLockProgress(deltaY);
    if (shouldLockVoice(deltaY, deltaX)) {
      setLocked(true);
      setLockProgress(VOICE_LOCK_SWIPE_PX);
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([10, 20, 10]);
    }
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      pointerMove(deltaY, deltaX = 0) {
        if (lockedRef.current || phase !== 'recording') return;
        tryLock(deltaY, deltaX);
      },
      pointerUp() {
        if (lockedRef.current || phase !== 'recording' || !micReadyRef.current) return;
        finishRecording();
      },
      pointerCancel() {
        cancelAll();
      },
      stopLocked() {
        if (!lockedRef.current || phase !== 'recording') return;
        finishRecording();
      },
    }),
    [cancelAll, finishRecording, phase, tryLock],
  );

  async function discardSaved() {
    const id = voiceNoteIdRef.current;
    if (!id || discarding) return;
    setDiscarding(true);
    cancelledRef.current = true;
    try {
      await fetch(`/api/dashboard/voice-notes/${id}`, { method: 'DELETE' });
      router.refresh();
    } catch {
      notifyError("La note n'a pas pu être supprimée");
    } finally {
      onClose();
    }
  }

  if (phase === 'saved') {
    return (
      <div
        className="app-tabbar pointer-events-auto fixed left-1/2 z-[115] flex -translate-x-1/2 items-center gap-2 rounded-2xl px-3 py-2 shadow-[0_8px_28px_rgba(15,23,34,0.14)]"
        style={{ bottom: CARD_BOTTOM, minWidth: 168 }}
        role="status"
        aria-live="polite"
      >
        <p className="min-w-0 flex-1 text-[12px] font-medium text-text-strong">Note enregistrée</p>
        <button
          type="button"
          onClick={() => void discardSaved()}
          disabled={discarding}
          aria-label="Annuler et supprimer la note"
          className="app-press flex size-7 shrink-0 items-center justify-center rounded-full text-text-muted"
        >
          <X size={16} strokeWidth={2.25} aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[115]" aria-live="polite">
      {phase === 'recording' && !locked ? (
        <div
          className="absolute left-1/2 -translate-x-1/2"
          style={{ bottom: LOCK_HINT_BOTTOM }}
        >
          <VoiceLockHint locked={false} progress={lockProgress} compact />
        </div>
      ) : null}

      {phase === 'recording' && locked ? (
        <div
          className="absolute left-1/2 -translate-x-1/2"
          style={{ bottom: LOCK_HINT_BOTTOM }}
        >
          <VoiceLockHint locked compact />
        </div>
      ) : null}

      <div
        className="app-tabbar pointer-events-auto fixed left-1/2 z-[115] -translate-x-1/2 rounded-2xl px-3 py-2 shadow-[0_8px_28px_rgba(15,23,34,0.14)]"
        style={{ bottom: CARD_BOTTOM, width: 132 }}
      >
        {phase === 'processing' ? (
          <div className="flex h-8 items-center justify-center gap-1" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="size-1.5 animate-pulse rounded-full bg-accent"
                style={{ animationDelay: `${i * 180}ms` }}
                aria-hidden
              />
            ))}
          </div>
        ) : (
          <VoiceWaveform stream={micStream} compact />
        )}
      </div>
    </div>
  );
});
