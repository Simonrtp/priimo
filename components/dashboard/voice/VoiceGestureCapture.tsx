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
import { notifyError, notifySuccess } from '@/lib/notify';
import { playRecordStopSound } from '@/lib/voice/feedback-sound';
import {
  createVoiceRecorder,
  holdScreenAwake,
  MAX_RECORD_BYTES,
  micErrorMessage,
  newClientId,
  requestMicStream,
  stopMicStream,
} from '@/lib/voice/mic';
import { isVoiceBlobTooSmall, MIN_VOICE_RECORD_MS } from '@/lib/voice/audio-blob';
import type { DevicePosition } from '@/lib/voice/gps';
import { readDevicePosition } from '@/lib/voice/gps';
import { reverseGeocode } from '@/lib/geo/ban';
import { shouldLockVoice, VOICE_LOCK_SWIPE_PX } from '@/lib/voice/gesture-lock';
import type { NoteReviewPayload } from '@/lib/notes/build-review';
import { postFormOrQueue } from '@/lib/offline/queue';
import VoiceWaveform from './VoiceWaveform';
import VoiceLockHint from './VoiceLockHint';
import { TranscriptionTempsReel, type PreparationTempsReel } from '@/lib/voice/temps-reel';
import { finDeNoteDite, retirerFinDeNote } from '@/lib/voice/fin-de-note';
import { cibleEnvolNote, envolerNote } from '@/lib/ui/envol-note';
import { useTourneeDictation } from '@/components/dashboard/field/TourneeDictationProvider';

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
    parcelleId?: string | null;
    banId?: string | null;
    streamPromise?: Promise<MediaStream> | null;
    preparation?: PreparationTempsReel | null;
    onLockedChange: (locked: boolean) => void;
    onClose: () => void;
  }
>(function VoiceGestureCapture({ adresse = null, parcelleId = null, banId = null, streamPromise, preparation = null, onLockedChange, onClose }, ref) {
  const router = useRouter();
  const { noteDictee, adresse: tourAdresse } = useTourneeDictation();

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
  const gpsRef = useRef<DevicePosition | null>(null);
  const recordedAtRef = useRef(new Date().toISOString());
  const tempsReelRef = useRef<TranscriptionTempsReel | null>(null);
  const finTempsReelRef = useRef<Promise<string> | null>(null);
  const texteDirectRef = useRef('');
  const horsLigneRef = useRef(false);
  const pastilleRef = useRef<HTMLDivElement | null>(null);

  lockedRef.current = locked;
  micReadyRef.current = micReady;
  voiceNoteIdRef.current = voiceNoteId;

  useEffect(() => {
    onLockedChange(locked);
  }, [locked, onLockedChange]);

  useEffect(() => {
    if (adresse) setGpsAddress(adresse);
    void readDevicePosition().then(async (pos) => {
      gpsRef.current = pos;
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
    const session = tempsReelRef.current;
    tempsReelRef.current = null;
    finTempsReelRef.current = session ? session.arreter() : null;
    recorder.stop();
    playRecordStopSound();
  }, []);

  const cancelAll = useCallback(() => {
    cancelledRef.current = true;
    tempsReelRef.current?.fermer();
    tempsReelRef.current = null;
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop();
    }
    recorderRef.current = null;
    releaseMic();
    onClose();
  }, [onClose, releaseMic]);

  async function upload(blob: Blob, durationMs: number) {
    setPhase('processing');
    releaseMic();

    if (blob.size === 0) {
      notifyError('Aucun son reçu.');
      onClose();
      return;
    }
    // Un effleurement n’est pas une dictée : pas de note vide dans l’accueil.
    if (durationMs < MIN_VOICE_RECORD_MS || isVoiceBlobTooSmall(blob.size)) {
      notifyError('Maintenez le bouton pendant que vous parlez.');
      onClose();
      return;
    }

    const form = new FormData();
    form.append('audio', blob, 'dictee.webm');
    form.append('durationSeconds', String(Math.max(1, Math.round(durationMs / 1000))));
    form.append('clientNoteId', newClientId());
    form.append('recordedAt', recordedAtRef.current);
    const fin = finTempsReelRef.current;
    finTempsReelRef.current = null;
    const direct = retirerFinDeNote((fin ? await fin.catch(() => texteDirectRef.current) : texteDirectRef.current) || '');
    if (direct) form.append('liveTranscript', direct);
    // Personne ne relit cette note à l’écran : le serveur la lit, même si
    // l’agent a déjà rangé son téléphone.
    form.append('extraireSurServeur', '1');
    // Position prise à l’ouverture : ne pas faire attendre l’envoi du GPS.
    const gps = gpsRef.current;
    if (gps) {
      form.append('latitude', String(gps.latitude));
      form.append('longitude', String(gps.longitude));
    }
    const addr = gpsAddress?.trim();
    if (addr) form.append('adresse', addr);
    if (parcelleId) form.append('parcelleId', parcelleId);
    if (banId) form.append('banId', banId);

    try {
      const { queued, res } = await postFormOrQueue('/api/dashboard/voice-notes', form);

      if (cancelledRef.current) return;

      if (queued) {
        if (tourAdresse) noteDictee();
        notifySuccess('Dictée enregistrée — envoi dès le retour du réseau');
        horsLigneRef.current = true;
        setPhase('saved');
        window.setTimeout(() => onClose(), 900);
        return;
      }

      if (!res) {
        notifyError("La dictée n'a pas pu être traitée");
        onClose();
        return;
      }

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
      if (tourAdresse) noteDictee();
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
      // Après l’envol : le chiffre monte d’abord à l’écran, le serveur confirme ensuite.
      window.setTimeout(() => router.refresh(), 1_400);
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
          preparation?.abandonner();
          return;
        }

        const recorder = createVoiceRecorder(stream);
        chunksRef.current = [];
        let bytes = 0;
        const releaseWake = holdScreenAwake();
        recordedAtRef.current = new Date().toISOString();

        recorder.ondataavailable = (e) => {
          if (e.data.size === 0) return;
          chunksRef.current.push(e.data);
          bytes += e.data.size;
          if (bytes >= MAX_RECORD_BYTES && recorder.state === 'recording') {
            recorder.stop();
            playRecordStopSound();
          }
        };
        recorder.onstop = () => {
          releaseWake();
          const durationMs = Date.now() - startedAtRef.current;
          stopMicStream(stream);
          setMicStream(null);
          if (cancelledRef.current) {
            chunksRef.current = [];
            recorderRef.current = null;
            return;
          }
          const blob = new Blob(chunksRef.current, {
            type: recorder.mimeType || 'audio/webm',
          });
          recorderRef.current = null;
          void uploadRef.current(blob, durationMs);
        };

        recorder.start(250);
        recorderRef.current = recorder;
        startedAtRef.current = Date.now();
        setMicStream(stream);
        setMicReady(true);

        // Le mot à mot reste hors écran ; « fin de note » termine une dictée verrouillée.
        void TranscriptionTempsReel.demarrer(
          stream,
          {
            onTexte: (t) => {
              texteDirectRef.current = t;
              if (finDeNoteDite(t) && lockedRef.current) finishRecording();
            },
          },
          preparation,
        ).then((session) => {
          if (recorderRef.current !== recorder || recorder.state !== 'recording' || cancelledRef.current) {
            session?.fermer();
            return;
          }
          tempsReelRef.current = session;
        });
      } catch (error) {
        preparation?.abandonner();
        notifyError(micErrorMessage(error));
        onClose();
      }
    }

    void start();
    return () => {
      cancelled = true;
    };
  }, [finishRecording, onClose, preparation, streamPromise]);

  useEffect(() => {
    if (phase !== 'saved') return;
    const t = window.setTimeout(() => onClose(), 5000);
    return () => window.clearTimeout(t);
  }, [phase, onClose]);

  // La note enregistrée part en vol de la pastille vers Notes terrain.
  useEffect(() => {
    if (phase !== 'saved') return;
    const rattachee = Boolean(gpsRef.current || banId || parcelleId);
    envolerNote({
      depart: pastilleRef.current?.getBoundingClientRect() ?? null,
      compte: !horsLigneRef.current && rattachee,
      cible: cibleEnvolNote({ echange: false, rattachee }),
    });
  }, [phase, banId, parcelleId]);

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
        ref={pastilleRef}
        className="app-tabbar pointer-events-auto fixed left-1/2 z-[115] flex -translate-x-1/2 items-center gap-2 rounded-2xl px-3 py-2 shadow-[0_8px_28px_rgba(26,42,86,0.14)]"
        style={{ bottom: CARD_BOTTOM, minWidth: 168 }}
        role="status"
        aria-live="polite"
      >
        <p className="min-w-0 flex-1 text-[12px] font-medium text-text-strong">Note enregistrée — Priimo la range</p>
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

      {phase === 'recording' && locked ? (
        <p className="sr-only">Dites « fin de note » pour terminer.</p>
      ) : null}

      <div
        className="app-tabbar pointer-events-auto fixed left-1/2 z-[115] -translate-x-1/2 rounded-2xl px-3 py-2 shadow-[0_8px_28px_rgba(26,42,86,0.14)]"
        style={{ bottom: CARD_BOTTOM, width: 132 }}
      >
        {phase === 'processing' ? (
          <div className="flex h-8 items-center justify-center gap-1" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="size-1.5 animate-pulse rounded-full bg-ia"
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
